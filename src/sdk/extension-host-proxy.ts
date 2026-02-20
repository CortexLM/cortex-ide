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

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ExtensionHostProxy {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageIdCounter: number = 0;
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private logHandler: ((level: string, message: string) => void) | null = null;

  constructor(private timeout: number = 30000) {}

  start(): void {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(
      new URL('../workers/extension-host.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event);
    };

    this.worker.onerror = (event: ErrorEvent) => {
      const error = new Error(event.message || 'Extension host worker error');
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(error);
        this.pendingRequests.delete(id);
      }
    };
  }

  stop(): void {
    if (!this.worker) {
      return;
    }

    const error = new Error('Extension host stopped');
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }

    this.worker.terminate();
    this.worker = null;
    this.pendingRequests.clear();
    this.eventListeners.clear();
    this.logHandler = null;
  }

  private sendRequest(type: WorkerMessage['type'], payload: unknown): Promise<unknown> {
    if (!this.worker) {
      return Promise.reject(new Error('Extension host worker is not running'));
    }

    const id = this.generateId();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Extension host request timed out'));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const message: WorkerMessage = { id, type, payload };
      this.worker!.postMessage(message);
    });
  }

  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;

    if (response.type === 'log') {
      if (this.logHandler) {
        const { level, message } = response.payload as { level: string; message: string };
        this.logHandler(level, message);
      }
      return;
    }

    if (response.type === 'event') {
      const { eventName, data } = response.payload as { eventName: string; data: unknown };
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        for (const listener of listeners) {
          listener(data);
        }
      }
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.type === 'error') {
      const { message } = response.payload as { message: string };
      pending.reject(new Error(message));
    } else {
      pending.resolve(response.payload);
    }
  }

  private generateId(): string {
    this.messageIdCounter += 1;
    return String(this.messageIdCounter);
  }

  async init(config: Record<string, unknown>): Promise<void> {
    await this.sendRequest('init', config);
  }

  async activateExtension(extensionId: string, manifest: unknown): Promise<{ activationTime: number }> {
    const result = await this.sendRequest('activate', { extensionId, manifest });
    return result as { activationTime: number };
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    await this.sendRequest('deactivate', { extensionId });
  }

  async executeCommand<T = unknown>(extensionId: string, command: string, args?: unknown[]): Promise<T> {
    const result = await this.sendRequest('execute', { extensionId, command, args });
    return result as T;
  }

  sendEvent(eventName: string, data: unknown): void {
    if (!this.worker) {
      return;
    }

    const id = this.generateId();
    const message: WorkerMessage = { id, type: 'event', payload: { eventName, data } };
    this.worker.postMessage(message);
  }

  async dispose(): Promise<void> {
    await this.sendRequest('dispose', {});
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.eventListeners.clear();
    this.logHandler = null;
  }

  onEvent(eventName: string, handler: (data: unknown) => void): () => void {
    let listeners = this.eventListeners.get(eventName);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(eventName, listeners);
    }
    listeners.add(handler);

    return () => {
      const current = this.eventListeners.get(eventName);
      if (current) {
        current.delete(handler);
        if (current.size === 0) {
          this.eventListeners.delete(eventName);
        }
      }
    };
  }

  onLog(handler: (level: string, message: string) => void): void {
    this.logHandler = handler;
  }

  get isRunning(): boolean {
    return this.worker !== null;
  }
}
