'use strict';

// ---------------------------------------------------------------------------
// Extension activation / deactivation lifecycle
//
// IMPORTANT: stdout is the JSON-RPC transport. All logging MUST use
// console.error (stderr) instead.
// ---------------------------------------------------------------------------

const path = require('path');
const Module = require('module');

const activeExtensions = new Map();

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'vscode') {
    return require.resolve('./vscode-api-shim.js');
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

class Memento {
  constructor() {
    this._data = {};
  }
  keys() { return Object.keys(this._data); }
  get(key, defaultValue) {
    return key in this._data ? this._data[key] : defaultValue;
  }
  update(key, value) {
    if (value === undefined) {
      delete this._data[key];
    } else {
      this._data[key] = value;
    }
    return Promise.resolve();
  }
}

function createExtensionContext(extensionId, extensionPath) {
  const subscriptions = [];
  const globalState = new Memento();
  const workspaceState = new Memento();

  return {
    subscriptions,
    extensionPath,
    extensionUri: { scheme: 'file', path: extensionPath, fsPath: extensionPath },
    storagePath: path.join(extensionPath, '.storage'),
    globalStoragePath: path.join(extensionPath, '.global-storage'),
    logPath: path.join(extensionPath, '.logs'),
    extensionMode: 1,
    globalState,
    workspaceState,
    secrets: {
      get(key) { return Promise.resolve(undefined); },
      store(key, value) { return Promise.resolve(); },
      delete(key) { return Promise.resolve(); },
      onDidChange: require('./vscode-api-shim.js').EventEmitter.prototype.event || (() => ({ dispose() {} })),
    },
    environmentVariableCollection: {
      persistent: false,
      replace(variable, value) {},
      append(variable, value) {},
      prepend(variable, value) {},
      get(variable) { return undefined; },
      forEach(callback) {},
      delete(variable) {},
      clear() {},
    },
    asAbsolutePath(relativePath) {
      return path.join(extensionPath, relativePath);
    },
    extension: {
      id: extensionId,
      extensionUri: { scheme: 'file', path: extensionPath, fsPath: extensionPath },
      extensionPath,
      isActive: true,
      packageJSON: {},
      extensionKind: 1,
      exports: undefined,
    },
  };
}

async function activateExtension(extensionId, extensionPath) {
  if (activeExtensions.has(extensionId)) {
    console.error(`[ext-host] Extension "${extensionId}" is already active`);
    return { success: true, alreadyActive: true };
  }

  const pkgPath = path.join(extensionPath, 'package.json');
  let pkg;
  try {
    pkg = require(pkgPath);
  } catch (e) {
    throw new Error(`Failed to read package.json for "${extensionId}": ${e.message}`);
  }

  const mainEntry = pkg.main || './extension.js';
  const mainPath = path.resolve(extensionPath, mainEntry);

  let extensionModule;
  try {
    extensionModule = require(mainPath);
  } catch (e) {
    throw new Error(`Failed to load extension module "${mainPath}": ${e.message}`);
  }

  const context = createExtensionContext(extensionId, extensionPath);

  if (typeof extensionModule.activate === 'function') {
    try {
      const result = await extensionModule.activate(context);
      context.extension.exports = result;
    } catch (e) {
      throw new Error(`Activation of "${extensionId}" failed: ${e.message}`);
    }
  }

  activeExtensions.set(extensionId, { module: extensionModule, context });
  console.error(`[ext-host] Activated extension: ${extensionId}`);
  return { success: true };
}

async function deactivateExtension(extensionId) {
  const entry = activeExtensions.get(extensionId);
  if (!entry) {
    console.error(`[ext-host] Extension "${extensionId}" is not active`);
    return { success: true, wasActive: false };
  }

  if (typeof entry.module.deactivate === 'function') {
    try {
      await entry.module.deactivate();
    } catch (e) {
      console.error(`[ext-host] Error deactivating "${extensionId}": ${e.message}`);
    }
  }

  for (const sub of entry.context.subscriptions) {
    try {
      if (sub && typeof sub.dispose === 'function') sub.dispose();
    } catch (_) {}
  }

  activeExtensions.delete(extensionId);
  console.error(`[ext-host] Deactivated extension: ${extensionId}`);
  return { success: true };
}

async function deactivateAll() {
  const ids = [...activeExtensions.keys()];
  for (const id of ids) {
    await deactivateExtension(id);
  }
}

function listActive() {
  return [...activeExtensions.keys()];
}

module.exports = {
  activateExtension,
  deactivateExtension,
  deactivateAll,
  listActive,
};
