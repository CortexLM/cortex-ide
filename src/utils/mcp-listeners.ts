/**
 * MCP (Model Context Protocol) Listeners
 * 
 * These listeners enable AI agents to interact with the Cortex Desktop webview.
 * They respond to events from the Tauri backend MCP server.
 */

import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

let executeJsUnlisten: (() => void) | null = null;
let getDomUnlisten: (() => void) | null = null;

/**
 * Set up MCP event listeners for the current window
 */
export async function setupMcpListeners() {
  const currentWindow = getCurrentWebviewWindow();
  
  // Listen for JavaScript execution requests
  executeJsUnlisten = await currentWindow.listen('mcp:execute-js', handleExecuteJs);
  
  // Listen for DOM content requests
  getDomUnlisten = await currentWindow.listen('mcp:get-dom', handleGetDom);
  
  if (import.meta.env.DEV) console.log('[MCP] Event listeners set up for execute-js and get-dom');
}

/**
 * Clean up MCP event listeners
 */
export function cleanupMcpListeners() {
  if (executeJsUnlisten) {
    executeJsUnlisten();
    executeJsUnlisten = null;
  }
  if (getDomUnlisten) {
    getDomUnlisten();
    getDomUnlisten = null;
  }
  if (import.meta.env.DEV) console.log('[MCP] Event listeners cleaned up');
}

/**
 * Handle JavaScript execution request from MCP
 * 
 * SECURITY: This function is completely disabled to prevent Remote Code Execution (RCE)
 * vulnerabilities. The previous implementation used `new Function()` which could be
 * exploited despite blocklist protections.
 */
async function handleExecuteJs(_event: { payload: string }) {
  // SECURITY: JavaScript execution via MCP is completely disabled to prevent RCE
  console.warn('[MCP] JavaScript execution via MCP is disabled for security reasons');
  await emit('mcp:execute-js-response', {
    success: false,
    error: 'JavaScript execution via MCP is disabled for security reasons',
    type: 'error'
  });
  return;
}

/**
 * Handle DOM content request from MCP
 */
async function handleGetDom(event: { payload: { selector?: string } }) {
  if (import.meta.env.DEV) console.log('[MCP] Received get-dom request');
  
  try {
    const { selector } = event.payload || {};
    
    let html: string;
    if (selector) {
      const element = document.querySelector(selector);
      html = element ? element.outerHTML : '';
    } else {
      html = document.documentElement.outerHTML;
    }
    
    await emit('mcp:get-dom-response', {
      success: true,
      html
    });
    if (import.meta.env.DEV) console.log('[MCP] Emitted get-dom-response (success), length:', html.length);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await emit('mcp:get-dom-response', {
      success: false,
      error: errorMessage
    });
    console.error('[MCP] Emitted get-dom-response (error):', errorMessage);
  }
}
