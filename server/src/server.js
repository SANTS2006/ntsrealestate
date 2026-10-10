import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectDatabase, warmDatabase } from './config/database.js';
import { closeSessionStore } from './config/session.js';
import { ensurePermissionCatalogSeeded, syncBuiltInRoleGrants } from './services/permission.service.js';
import { initRealtime } from './realtime/socket.js';
import { startBackupScheduler, stopBackupScheduler } from './services/backup/scheduler.js';

const app = createApp();

let server;
ensurePermissionCatalogSeeded()
  .then(() => {
    server = app.listen(env.PORT, () => {
      logger.info(`NTS Real Estate System API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    });
    // Bounded request lifetimes, and a keep-alive longer than the load
    // balancer's so it never reuses a connection we have just closed.
    server.requestTimeout = 120_000;
    server.headersTimeout = 66_000;
    server.keepAliveTimeout = 65_000;
    initRealtime(server);
    startBackupScheduler();
    warmDatabase();
    syncBuiltInRoleGrants().catch((err) => logger.error({ err }, 'could not update built-in role permissions'));
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to seed permission catalog — refusing to start');
    process.exit(1);
  });

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  stopBackupScheduler();
  const closeAndExit = async () => {
    try {
      await disconnectDatabase();
      await closeSessionStore();
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  if (server) { server.close(closeAndExit); server.closeIdleConnections?.(); }
  else await closeAndExit();

  // Force-exit if connections don't close within a reasonable window.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
