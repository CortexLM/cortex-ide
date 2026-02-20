/**
 * Socket client for connecting to Cortex Desktop's MCP socket server
 */

import * as net from "net";

interface SocketRequest {
  command: string;
  payload: Record<string, unknown>;
}

interface SocketResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (response: SocketResponse) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  command: string;
}

// Command-specific timeouts (in ms)
const COMMAND_TIMEOUTS: Record<string, number> = {
  takeScreenshot: 60000,  // Screenshots can take longer
  getDom: 60000,          // DOM can be large
  executeJs: 60000,       // JS execution varies
  default: 30000,         // Default timeout
};

export class CortexSocketClient {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;
  private connected: boolean = false;
  private connecting: boolean = false;
  private responseBuffer: string = "";
  private pendingRequest: PendingRequest | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  constructor(host: string = "127.0.0.1", port: number = 4000) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    if (this.connected && this.socket) {
      return;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.connected) {
            clearInterval(checkInterval);
            resolve();
          } else if (!this.connecting) {
            clearInterval(checkInterval);
            reject(new Error("Connection failed"));
          }
        }, 100);
        
        // Timeout waiting for connection
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!this.connected) {
            reject(new Error("Connection timeout"));
          }
        }, 10000);
      });
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      // Set socket timeout
      this.socket.setTimeout(60000);

      const connectTimeout = setTimeout(() => {
        this.connecting = false;
        if (this.socket) {
          this.socket.destroy();
          this.socket = null;
        }
        reject(new Error("Connection timeout"));
      }, 10000);

      this.socket.on("connect", () => {
        clearTimeout(connectTimeout);
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        console.error(`[MCP Client] Connected to Cortex Desktop at ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on("data", (data) => {
        this.handleData(data);
      });

      this.socket.on("timeout", () => {
        console.error("[MCP Client] Socket timeout");
        if (this.pendingRequest) {
          this.clearPendingRequest(new Error("Socket timeout"));
        }
      });

      this.socket.on("error", (err) => {
        clearTimeout(connectTimeout);
        console.error("[MCP Client] Socket error:", err.message);
        this.connected = false;
        this.connecting = false;
        
        if (this.pendingRequest) {
          this.clearPendingRequest(err);
        }
        
        reject(err);
      });

      this.socket.on("close", () => {
        console.error("[MCP Client] Connection closed");
        this.connected = false;
        this.connecting = false;
        this.socket = null;
        
        if (this.pendingRequest) {
          this.clearPendingRequest(new Error("Connection closed"));
        }
      });

      this.socket.connect(this.port, this.host);
    });
  }

  private handleData(data: Buffer): void {
    this.responseBuffer += data.toString();
    
    // Process all complete JSON responses in buffer
    let newlineIndex: number;
    while ((newlineIndex = this.responseBuffer.indexOf("\n")) !== -1) {
      const jsonStr = this.responseBuffer.substring(0, newlineIndex);
      this.responseBuffer = this.responseBuffer.substring(newlineIndex + 1);
      
      if (!jsonStr.trim()) continue;
      
      try {
        const response = JSON.parse(jsonStr) as SocketResponse;
        if (this.pendingRequest) {
          const { resolve, timeoutId } = this.pendingRequest;
          clearTimeout(timeoutId);
          this.pendingRequest = null;
          resolve(response);
        }
      } catch (e) {
        console.error("[MCP Client] Failed to parse response:", e, "Raw:", jsonStr.substring(0, 200));
        if (this.pendingRequest) {
          this.clearPendingRequest(new Error(`Failed to parse response: ${e}`));
        }
      }
    }
  }

  private clearPendingRequest(error: Error): void {
    if (this.pendingRequest) {
      const { reject, timeoutId } = this.pendingRequest;
      clearTimeout(timeoutId);
      this.pendingRequest = null;
      reject(error);
    }
  }

  private getTimeout(command: string): number {
    return COMMAND_TIMEOUTS[command] || COMMAND_TIMEOUTS.default;
  }

  async sendCommand(command: string, payload: Record<string, unknown> = {}): Promise<SocketResponse> {
    // Ensure we're connected
    if (!this.connected || !this.socket) {
      try {
        await this.connect();
      } catch (err) {
        // Try to reconnect if initial connection failed
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.error(`[MCP Client] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.sendCommand(command, payload);
        }
        throw err;
      }
    }

    // Wait if there's already a pending request
    if (this.pendingRequest) {
      console.error(`[MCP Client] Waiting for pending request: ${this.pendingRequest.command}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.pendingRequest) {
        throw new Error("Another request is already in progress");
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not connected"));
        return;
      }

      const timeout = this.getTimeout(command);
      
      const timeoutId = setTimeout(() => {
        if (this.pendingRequest) {
          console.error(`[MCP Client] Request timeout for command: ${command} (${timeout}ms)`);
          this.pendingRequest = null;
          reject(new Error(`Request timed out after ${timeout}ms`));
        }
      }, timeout);

      this.pendingRequest = {
        resolve,
        reject,
        timeoutId,
        command,
      };

      const request: SocketRequest = { command, payload };
      const json = JSON.stringify(request) + "\n";
      
      this.socket.write(json, (err) => {
        if (err) {
          this.clearPendingRequest(err);
        }
      });
    });
  }

  disconnect(): void {
    if (this.pendingRequest) {
      this.clearPendingRequest(new Error("Client disconnected"));
    }
    
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const socketClient = new CortexSocketClient(
  process.env.CORTEX_MCP_HOST || "127.0.0.1",
  parseInt(process.env.CORTEX_MCP_PORT || "4000", 10)
);
