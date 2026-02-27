// E2E test: connects to bridge as jarvis-ui device and sends device commands to the device agent
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

const BRIDGE_URL = 'ws://127.0.0.1:19300';
const TARGET_DEVICE_ID = '2a32294c-8c80-41a3-a21c-e78dbe112ab3'; // device agent

// Use the existing debug-test device credentials
const DEVICE_ID = 'df1e4703-666c-48b8-bedc-337b143b5602';
const TOKEN = 'e0135de5-5898-458e-b8ef-31206741d91e';

function send(ws, frame) {
  ws.send(JSON.stringify(frame));
}

function waitForMessage(ws, predicate, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
    const handler = (data) => {
      const frame = JSON.parse(data.toString());
      if (predicate(frame)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(frame);
      }
    };
    ws.on('message', handler);
  });
}

async function test(ws, name, subsystem, action, params = {}) {
  const id = randomUUID();
  const responsePromise = waitForMessage(ws, f => f.id === id);

  send(ws, {
    type: 'device.command',
    id,
    payload: { targetDeviceId: TARGET_DEVICE_ID, subsystem, action, params }
  });

  const response = await responsePromise;
  const success = response.payload.success;
  const duration = response.payload.durationMs;
  const status = success ? 'PASS' : 'FAIL';
  const detail = success
    ? (duration ? `${duration}ms` : 'ok')
    : response.payload.error;

  console.log(`  [${status}] ${name} — ${detail}`);
  return response.payload;
}

async function run() {
  console.log('Connecting to bridge...');
  const ws = new WebSocket(BRIDGE_URL);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  // Authenticate
  const authId = randomUUID();
  const authPromise = waitForMessage(ws, f => f.id === authId);
  send(ws, { type: 'auth', id: authId, payload: { deviceId: DEVICE_ID, token: TOKEN } });
  const authResp = await authPromise;

  if (!authResp.payload.success) {
    console.error('Auth failed:', authResp.payload);
    process.exit(1);
  }
  console.log('Authenticated as debug-test device\n');

  console.log('=== Clipboard Tests ===');
  await test(ws, 'clipboard.set', 'clipboard', 'set', { text: 'JARVIS E2E Test' });
  const clipResult = await test(ws, 'clipboard.get', 'clipboard', 'get');
  if (clipResult.success && clipResult.data?.text === 'JARVIS E2E Test') {
    console.log('  [PASS] Clipboard round-trip verified');
  } else {
    console.log('  [FAIL] Clipboard round-trip mismatch:', clipResult.data?.text);
  }

  console.log('\n=== Apps Tests ===');
  const listResult = await test(ws, 'apps.list', 'apps', 'list');
  if (listResult.success) {
    console.log(`  Found ${listResult.data?.processes?.length ?? 0} windowed processes`);
  }

  await test(ws, 'apps.getActive', 'apps', 'getActive');

  console.log('\n=== Screen Tests ===');
  const screenResult = await test(ws, 'screen.capture', 'screen', 'capture');
  if (screenResult.success) {
    const sizeKB = Math.round(screenResult.data.sizeBytes / 1024);
    console.log(`  Screenshot: ${sizeKB} KB, format: ${screenResult.data.format}`);
  }

  console.log('\n=== Files Tests ===');
  await test(ws, 'files.list (allowed)', 'files', 'list', { path: 'C:\\Users\\tyson\\Desktop' });
  await test(ws, 'files.exists (allowed)', 'files', 'exists', { path: 'C:\\Users\\tyson\\Desktop' });
  await test(ws, 'files.list (denied)', 'files', 'list', { path: 'C:\\Windows\\System32' });

  console.log('\n=== Notify Tests ===');
  await test(ws, 'notify.send', 'notify', 'send', { title: 'JARVIS', message: 'Device Control E2E test passed!' });

  console.log('\n=== Kill Switch Tests ===');
  await test(ws, '_control.kill', '_control', 'kill');
  await test(ws, 'clipboard.get (should fail)', 'clipboard', 'get');
  await test(ws, '_control.unkill', '_control', 'unkill');
  await test(ws, 'clipboard.get (should work)', 'clipboard', 'get');

  console.log('\nAll tests complete!');
  ws.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
