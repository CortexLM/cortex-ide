'use strict';

// ---------------------------------------------------------------------------
// Extension Host — Node.js sidecar entry point
//
// Communicates with the Rust backend via line-delimited JSON-RPC on
// stdin (incoming) / stdout (outgoing).
//
// IMPORTANT: stdout is the JSON-RPC transport. All logging MUST go to
// stderr via console.error.
// ---------------------------------------------------------------------------

const readline = require('readline');
const activation = require('./activation');

function sendResponse(id, result, error) {
  const msg = { jsonrpc: '2.0', id };
  if (error) {
    msg.error = { code: -32000, message: String(error) };
  } else {
    msg.result = result !== undefined ? result : null;
  }
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendNotification(method, params) {
  const msg = { jsonrpc: '2.0', method, params };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const handlers = {
  async initialize(params) {
    console.error('[ext-host] Initialized with capabilities:', JSON.stringify(params && params.capabilities ? Object.keys(params.capabilities) : []));
    return { ready: true };
  },

  async activateExtension(params) {
    if (!params || !params.extensionId || !params.extensionPath) {
      throw new Error('Missing extensionId or extensionPath');
    }
    return await activation.activateExtension(params.extensionId, params.extensionPath);
  },

  async deactivateExtension(params) {
    if (!params || !params.extensionId) {
      throw new Error('Missing extensionId');
    }
    return await activation.deactivateExtension(params.extensionId);
  },

  async installExtension(params) {
    console.error('[ext-host] Extension installed notification:', params && params.extensionId);
    return { acknowledged: true };
  },

  async listExtensions(_params) {
    return { active: activation.listActive() };
  },

  async executeCommand(params) {
    if (!params || !params.command) {
      throw new Error('Missing command');
    }
    const vscode = require('./vscode-api-shim');
    const result = await vscode.commands.executeCommand(params.command, ...(params.args || []));
    return { result: result !== undefined ? result : null };
  },

  async shutdown(_params) {
    console.error('[ext-host] Shutting down...');
    await activation.deactivateAll();
    process.nextTick(() => process.exit(0));
    return { success: true };
  },
};

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (e) {
    console.error('[ext-host] Invalid JSON:', e.message);
    return;
  }

  if (msg.id !== undefined && msg.method) {
    const handler = handlers[msg.method];
    if (!handler) {
      sendResponse(msg.id, null, `Unknown method: ${msg.method}`);
      return;
    }
    try {
      const result = await handler(msg.params);
      sendResponse(msg.id, result);
    } catch (e) {
      console.error(`[ext-host] Error handling "${msg.method}":`, e.message);
      sendResponse(msg.id, null, e.message);
    }
  }
});

rl.on('close', () => {
  console.error('[ext-host] stdin closed, shutting down');
  activation.deactivateAll().then(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('[ext-host] Uncaught exception:', err);
  sendNotification('host/error', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  console.error('[ext-host] Unhandled rejection:', reason);
  sendNotification('host/error', { message: String(reason) });
});

console.error('[ext-host] Extension host process started');
sendNotification('host/ready', { pid: process.pid });
