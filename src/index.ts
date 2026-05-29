import './instrument.js';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { DeliveryQueue } from './delivery/queue.js';
import { postToSpace } from './gchat/client.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.server.logLevel);

const queue = new DeliveryQueue({
  deliver: (webhookUrl, message) => postToSpace(webhookUrl, message),
  logger,
});

const app = createApp({
  clientSecret: config.sentry.clientSecret,
  gchat: config.gchat,
  queue,
  logger,
});

const server = serve({ fetch: app.fetch, port: config.server.port }, (info) => {
  logger.info({ port: info.port, env: config.server.nodeEnv }, 'sentry-google-chat listening');
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down; draining delivery queue');
  server.close();
  await queue.drain();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
