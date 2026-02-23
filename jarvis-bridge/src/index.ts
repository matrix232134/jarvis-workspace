import { loadConfig } from './config.js';
import * as registry from './device-registry.js';
import { startServer } from './bridge-server.js';
import * as logger from './logger.js';

const config = loadConfig();

logger.log('JARVIS Bridge starting...');
logger.log(`OpenClaw endpoint: ${config.openclaw.url}`);

registry.load();
startServer(config);
