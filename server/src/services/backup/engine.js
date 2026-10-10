import { createInterface } from 'node:readline';
import pg from 'pg';
import { env } from '../../config/env.js';
import { openBackupFile, writeBackupFile } from './fileCrypto.js';

// The dump/restore engine. It speaks plain SQL over a direct database
// connection, so it needs no pg_dump binary (hosting images rarely have one).
//
// Dump: one REPEATABLE READ, read-only transaction → a consistent snapshot even
// while the app keeps writing. Tables are written in foreign-key order, one
// "<table>\t<row as JSON>" line per row, with a header and a footer carrying the
// row counts. Row JSON is never parsed on the way through (so numbers keep
// full precision); it is handed back to Postgres, which converts it per column.
//
// Restore: ONE transaction — truncate, reinsert in the same order, count every
// table, and only COMMIT if all counts match the backup. Any failure rolls back
// and leaves the live data exactly as it was.

// Never dumped or restored: sessions (people stay signed in), the backup
// bookkeeping itself (a restore must not erase its own record), idempotency
// keys, and the migration history (checked for compatibility instead).
export const EXCLUDED_TABLES = ['session', 'backups', 'backup_restores', 'idempotency_keys', '_prisma_migrations'];
const BATCH_ROWS = 1000;
const RESTORE_BATCH_ROWS = 500;

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

export async function connectDirect() {
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const client = new pg.Client({ connectionString, statement_timeout: 0 });
    client.on('error', () => {}); // a dropped connection is reported by the running query
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
}

// Tables in the order they can be inserted: parents before the tables that
// reference them.
export async function listTablesInDependencyOrder(client, schema, excluded = EXCLUDED_TABLES) {
  const tables = (await client.query(
    `SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1`,
    [schema]
  )).rows.map((r) => r.name).filter((n) => !excluded.includes(n));
  const fks = (await client.query(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = $1::regnamespace`,
    [schema]
  )).rows;
  const strip = (n) => n.replace(/^"|"$/g, '').replace(new RegExp(`^${schema}\\.`), '').replace(/^"|"$/g, '');
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of fks) {
    const c = strip(child); const p = strip(parent);
    if (c !== p && deps.has(c) && deps.has(p)) deps.get(c).add(p);
  }
  return orderByDependencies(deps);
}

// Exported for tests.
export function orderByDependencies(deps) {
  const done = new Set();
  const order = [];
  let progressed = true;
  while (order.length < deps.size && progressed) {
    progressed = false;
    for (const [table, parents] of [...deps].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (!done.has(table) && [...parents].every((p) => done.has(p))) {
        done.add(table); order.push(table); progressed = true;
      }
    }
  }
  if (order.length < deps.size) {
    throw new Error(`Cannot order tables for backup (circular references: ${[...deps.keys()].filter((t) => !done.has(t)).join(', ')}).`);
  }
  return order;
}

async function tableColumns(client, schema, table) {
  return (await client.query(
    `SELECT column_name::text AS name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [schema, table]
  )).rows.map((r) => r.name);
}

async function orderColumns(client, schema, table) {
  const pk = (await client.query(
    `SELECT a.attname::text AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary ORDER BY array_position(i.indkey::int2[], a.attnum)`,
    [`${q(schema)}.${q(table)}`]
  )).rows.map((r) => q(r.name));
  return pk.length ? pk.join(', ') : 'ctid';
}

export async function latestMigration(client, schema) {
  try {
    const r = await client.query(`SELECT migration_name FROM ${q(schema)}."_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1`);
    return r.rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
}

// Writes the dump to `filePath`. Returns { sizeBytes, encrypted, counts, tables, rowCount, migration }.
export async function dumpToFile({ schema = 'public', filePath, key, onProgress }) {
  const client = await connectDirect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = await listTablesInDependencyOrder(client, schema);
    const migration = await latestMigration(client, schema);
    const counts = {};
    const columns = {};

    const file = await writeBackupFile(filePath, key, async (write) => {
      for (const table of tables) columns[table] = await tableColumns(client, schema, table);
      await write(`#REMS-BACKUP ${JSON.stringify({ format: 1, createdAt: new Date().toISOString(), schema, migration, tables, columns })}\n`);
      for (const table of tables) {
        const order = await orderColumns(client, schema, table);
        let offset = 0;
        counts[table] = 0;
        for (;;) {
          const { rows } = await client.query(
            `SELECT row_to_json(t)::text AS j FROM ${q(schema)}.${q(table)} t ORDER BY ${order.replace(/(^|, )"/g, '$1t."')} LIMIT ${BATCH_ROWS} OFFSET ${offset}`
          );
          if (rows.length === 0) break;
          await write(rows.map((r) => `${table}\t${r.j}\n`).join(''));
          counts[table] += rows.length;
          offset += rows.length;
          if (rows.length < BATCH_ROWS) break;
        }
        onProgress?.(table, counts[table]);
      }
      await write(`#END ${JSON.stringify({ counts })}\n`);
    });
    await client.query('COMMIT');
    const rowCount = Object.values(counts).reduce((a, b) => a + b, 0);
    return { ...file, counts, tables, rowCount, migration };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

// Reads a backup end to end without touching any database: checks the header,
// every line, and that the footer's counts match what was actually read.
export async function inspectBackupFile({ filePath, key }) {
  const stream = await openBackupFile(filePath, key);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  let footer = null;
  const seen = {};
  for await (const line of rl) {
    if (line.startsWith('#REMS-BACKUP ')) { header = JSON.parse(line.slice(13)); continue; }
    if (line.startsWith('#END ')) { footer = JSON.parse(line.slice(5)); continue; }
    if (!line) continue;
    if (!header) throw new Error('Backup has no header.');
    const tab = line.indexOf('\t');
    const table = line.slice(0, tab);
    if (tab < 1 || !header.tables.includes(table)) throw new Error('Backup contains a row for an unknown table.');
    JSON.parse(line.slice(tab + 1)); // structurally valid JSON
    seen[table] = (seen[table] ?? 0) + 1;
  }
  if (!header) throw new Error('Backup has no header.');
  if (!footer) throw new Error('Backup is incomplete (no end marker).');
  for (const table of header.tables) {
    if ((seen[table] ?? 0) !== (footer.counts[table] ?? 0)) throw new Error(`Row count mismatch in "${table}".`);
  }
  return { header, counts: footer.counts, rowCount: Object.values(footer.counts).reduce((a, b) => a + b, 0) };
}

// Replaces the live data with the backup's, atomically. `onPhase` is told when
// the work moves from "restoring" to "verifying". Throws (after rolling back)
// if anything is wrong, including a count that does not match.
export async function restoreFromFile({ schema = 'public', filePath, key, onPhase, lockTimeout = '60s' }) {
  const { header, counts: expected } = await inspectBackupFile({ filePath, key });
  const client = await connectDirect();
  try {
    // Compatibility: same migration, same tables, same columns.
    const liveMigration = await latestMigration(client, schema);
    if (header.migration && liveMigration && header.migration !== liveMigration) {
      throw new Error(`This backup was taken on schema version "${header.migration}" but the database is on "${liveMigration}". Restore is refused.`);
    }
    const liveTables = await listTablesInDependencyOrder(client, schema);
    for (const t of header.tables) {
      if (!liveTables.includes(t)) throw new Error(`The database has no table "${t}" that the backup contains.`);
      const cols = await tableColumns(client, schema, t);
      if (JSON.stringify(cols) !== JSON.stringify(header.columns[t])) throw new Error(`Table "${t}" has different columns than the backup.`);
    }
    for (const t of liveTables) {
      if (!header.tables.includes(t)) throw new Error(`The database has a table "${t}" that the backup does not contain.`);
    }

    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '${lockTimeout}'`);
    await client.query(`TRUNCATE ${[...header.tables].reverse().map((t) => `${q(schema)}.${q(t)}`).join(', ')}`);

    const stream = await openBackupFile(filePath, key);
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let current = null;
    let batch = [];
    const flush = async () => {
      if (!current || batch.length === 0) return;
      const target = `${q(schema)}.${q(current)}`;
      await client.query(`INSERT INTO ${target} SELECT * FROM json_populate_recordset(null::${target}, $1::json)`, [`[${batch.join(',')}]`]);
      batch = [];
    };
    for await (const line of rl) {
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      const table = line.slice(0, tab);
      if (table !== current) { await flush(); current = table; }
      batch.push(line.slice(tab + 1));
      if (batch.length >= RESTORE_BATCH_ROWS) await flush();
    }
    await flush();

    onPhase?.('verifying');
    for (const t of header.tables) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${q(schema)}.${q(t)}`);
      if (rows[0].n !== (expected[t] ?? 0)) throw new Error(`After restoring, "${t}" has ${rows[0].n} rows but the backup has ${expected[t] ?? 0}.`);
    }
    await client.query('COMMIT');
    return { counts: expected, tables: header.tables, createdAt: header.createdAt };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}
