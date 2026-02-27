import { loadConfig } from './config.js';
import { init as initSecurity } from './security.js';
import { register } from './subsystem-registry.js';
import { connect } from './device-client.js';
import { handle as screenHandle } from './subsystems/screen.js';
import { handle as inputHandle } from './subsystems/input.js';
import { handle as clipboardHandle } from './subsystems/clipboard.js';
import { handle as appsHandle } from './subsystems/apps.js';
import { handle as notifyHandle } from './subsystems/notify.js';
import { handle as filesHandle } from './subsystems/files.js';
import { handle as browserHandle } from './subsystems/browser.js';
import { VoiceModule } from './voice/voice-module.js';
import * as logger from './logger.js';

logger.log('JARVIS Device Agent starting...');

// Load config
const config = loadConfig();
logger.log(`Device: ${config.device.name}`);
logger.log(`Capabilities: ${config.capabilities.join(', ')}`);

// Initialize security
initSecurity(config.security);

// Register subsystems
register('screen', screenHandle);
register('input', inputHandle);
register('clipboard', clipboardHandle);
register('apps', appsHandle);
register('notify', notifyHandle);
register('files', filesHandle);
register('browser', browserHandle);

// Connect to bridge
connect(config);

// Start voice module (OpenWakeWord — no API keys needed)
if (config.voice?.enabled !== false) {
  const voice = new VoiceModule({
    micDeviceName: config.voice?.micDeviceName,
    wakeWordThreshold: config.voice?.wakeWordThreshold,
  });
  // Delay voice start slightly to let bridge connection establish
  setTimeout(() => {
    voice.start().catch((err) => {
      logger.error(`Voice module failed to start: ${err}`);
    });
  }, 2000);
} else {
  logger.log('Voice module: disabled (voice.enabled = false in config)');
}

logger.log('Device agent initialized');
