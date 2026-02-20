const workerSelf = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
  close: () => void;
};

interface WorkerMessage {
  id: string;
  type: 'init' | 'activate' | 'deactivate' | 'execute' | 'event' | 'dispose';
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  type: 'result' | 'error' | 'event' | 'log';
  payload: unknown;
}

interface ExtensionInstance {
  id: string;
  status: 'active' | 'inactive' | 'error';
  exports: Record<string, (...args: unknown[]) => unknown>;
  activationTime: number;
}

const extensions: Map<string, ExtensionInstance> = new Map();

function postResponse(response: WorkerResponse): void {
  workerSelf.postMessage(response);
}

function postLog(level: string, message: string): void {
  postResponse({
    id: '',
    type: 'log',
    payload: { level, message },
  });
}

function handleInit(msg: WorkerMessage): void {
  try {
    postLog('info', 'Extension host worker initializing');
    extensions.clear();
    postResponse({
      id: msg.id,
      type: 'result',
      payload: { status: 'ready' },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Init failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

function handleActivate(msg: WorkerMessage): void {
  try {
    const { extensionId, manifest } = msg.payload as {
      extensionId: string;
      manifest: unknown;
    };
    const startTime = performance.now();

    if (extensions.has(extensionId)) {
      postResponse({
        id: msg.id,
        type: 'error',
        payload: { message: `Extension "${extensionId}" is already active` },
      });
      return;
    }

    const instance: ExtensionInstance = {
      id: extensionId,
      status: 'active',
      exports: {},
      activationTime: performance.now() - startTime,
    };

    extensions.set(extensionId, instance);
    postLog('info', `Extension "${extensionId}" activated in ${instance.activationTime.toFixed(2)}ms (manifest: ${typeof manifest})`);

    postResponse({
      id: msg.id,
      type: 'result',
      payload: { activationTime: instance.activationTime },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Activate failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

function handleDeactivate(msg: WorkerMessage): void {
  try {
    const { extensionId } = msg.payload as { extensionId: string };
    const instance = extensions.get(extensionId);

    if (!instance) {
      postResponse({
        id: msg.id,
        type: 'error',
        payload: { message: `Extension "${extensionId}" not found` },
      });
      return;
    }

    instance.status = 'inactive';
    extensions.delete(extensionId);
    postLog('info', `Extension "${extensionId}" deactivated`);

    postResponse({
      id: msg.id,
      type: 'result',
      payload: { extensionId },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Deactivate failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

function handleExecute(msg: WorkerMessage): void {
  try {
    const { extensionId, command, args } = msg.payload as {
      extensionId: string;
      command: string;
      args?: unknown[];
    };

    const instance = extensions.get(extensionId);
    if (!instance) {
      postResponse({
        id: msg.id,
        type: 'error',
        payload: { message: `Extension "${extensionId}" not found` },
      });
      return;
    }

    if (instance.status !== 'active') {
      postResponse({
        id: msg.id,
        type: 'error',
        payload: { message: `Extension "${extensionId}" is not active` },
      });
      return;
    }

    const handler = instance.exports[command];
    if (typeof handler !== 'function') {
      postResponse({
        id: msg.id,
        type: 'error',
        payload: { message: `Command "${command}" not found on extension "${extensionId}"` },
      });
      return;
    }

    const result = handler(...(args ?? []));
    postResponse({
      id: msg.id,
      type: 'result',
      payload: result,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Execute failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

function handleEvent(msg: WorkerMessage): void {
  try {
    const { eventName, data } = msg.payload as {
      eventName: string;
      data: unknown;
    };

    for (const [id, instance] of extensions) {
      if (instance.status !== 'active') continue;

      const handler = instance.exports[`on${eventName}`];
      if (typeof handler === 'function') {
        try {
          handler(data);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          postLog('warn', `Event handler error in extension "${id}": ${errorMessage}`);
        }
      }
    }

    postResponse({
      id: msg.id,
      type: 'result',
      payload: { eventName, delivered: true },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Event broadcast failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

function handleDispose(msg: WorkerMessage): void {
  try {
    const extensionIds = Array.from(extensions.keys());
    for (const id of extensionIds) {
      const instance = extensions.get(id);
      if (instance) {
        instance.status = 'inactive';
      }
    }
    extensions.clear();

    postLog('info', `Extension host disposed, cleaned up ${extensionIds.length} extension(s)`);

    postResponse({
      id: msg.id,
      type: 'result',
      payload: { disposed: true, count: extensionIds.length },
    });

    workerSelf.close();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postLog('error', `Dispose failed: ${errorMessage}`);
    postResponse({
      id: msg.id,
      type: 'error',
      payload: { message: errorMessage },
    });
  }
}

workerSelf.onmessage = (event: MessageEvent<WorkerMessage>): void => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      handleInit(msg);
      break;
    case 'activate':
      handleActivate(msg);
      break;
    case 'deactivate':
      handleDeactivate(msg);
      break;
    case 'execute':
      handleExecute(msg);
      break;
    case 'event':
      handleEvent(msg);
      break;
    case 'dispose':
      handleDispose(msg);
      break;
  }
};
