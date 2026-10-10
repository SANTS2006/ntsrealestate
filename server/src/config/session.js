import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { env, isProduction } from './env.js';

// Sessions are persisted in the same Neon Postgres database (a dedicated
// `session` table managed by connect-pg-simple), not Redis and not in-memory
// — see docs/security/authentication.md §2. A plain `pg` Pool is used here
// (rather than the Neon serverless driver) because connect-pg-simple issues
// its own pooled, long-lived queries outside of Prisma's request lifecycle.
const sessionPool = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.SESSION_POOL_SIZE, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });

const PgSession = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // seconds
  }),
  name: 'rems.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // sliding idle timeout — refresh maxAge on every response
  cookie: {
    httpOnly: true,
    secure: isProduction, // requires HTTPS in production
    sameSite: 'lax',
    maxAge: env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000,
    path: '/',
  },
});

export async function closeSessionStore() {
  await sessionPool.end();
}

// "Log out everywhere" / forced re-authentication after a password change or
// reset. connect-pg-simple stores session data as an opaque JSON blob (no
// Prisma model — see prisma/schema.prisma's note on the `session` table), so
// this queries it directly rather than through the ORM. `exceptSid` lets a
// caller preserve the session making the request itself (e.g. right before
// regenerating it) when relevant.
export async function destroyAllSessionsForUser(userId, exceptSid = null) {
  if (exceptSid) {
    await sessionPool.query(`DELETE FROM "session" WHERE (sess::jsonb->>'userId') = $1 AND sid != $2`, [userId, exceptSid]);
  } else {
    await sessionPool.query(`DELETE FROM "session" WHERE (sess::jsonb->>'userId') = $1`, [userId]);
  }
}
