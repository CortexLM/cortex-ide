//! VS Code API shim — bridges VS Code API calls from the Node.js extension
//! host into Tauri IPC events and backend state mutations.
//!
//! When an extension calls e.g. `vscode.window.showInformationMessage(...)`,
//! the Node.js host process translates that into a JSON-RPC notification
//! which arrives here.  This module dispatches each call to the appropriate
//! Tauri event or backend state manager so the frontend can render the result.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tracing::info;

// ============================================================================
// API Namespace metadata (kept from the original api_surface.rs)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiNamespace {
    Window,
    Workspace,
    Languages,
    Commands,
    Debug,
    Extensions,
    Env,
    Tasks,
    Scm,
    Comments,
    Authentication,
    Tests,
    Notebooks,
    TreeView,
    Webview,
    CustomEditors,
    FileDecorationProvider,
    SourceControl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiCapability {
    pub namespace: ApiNamespace,
    pub methods: Vec<String>,
}

pub fn get_supported_api_surface() -> Vec<ApiCapability> {
    vec![
        ApiCapability {
            namespace: ApiNamespace::Window,
            methods: vec![
                "showInformationMessage".into(),
                "showWarningMessage".into(),
                "showErrorMessage".into(),
                "showQuickPick".into(),
                "showInputBox".into(),
                "showOpenDialog".into(),
                "showSaveDialog".into(),
                "createOutputChannel".into(),
                "createStatusBarItem".into(),
                "withProgress".into(),
                "createTreeView".into(),
                "registerTreeDataProvider".into(),
                "createWebviewPanel".into(),
                "registerWebviewViewProvider".into(),
                "showTextDocument".into(),
                "createTerminal".into(),
                "setStatusBarMessage".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Workspace,
            methods: vec![
                "getConfiguration".into(),
                "openTextDocument".into(),
                "applyEdit".into(),
                "findFiles".into(),
                "saveAll".into(),
                "createFileSystemWatcher".into(),
                "onDidChangeConfiguration".into(),
                "onDidOpenTextDocument".into(),
                "onDidCloseTextDocument".into(),
                "onDidChangeTextDocument".into(),
                "onDidSaveTextDocument".into(),
                "getWorkspaceFolder".into(),
                "registerTextDocumentContentProvider".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Languages,
            methods: vec![
                "registerCompletionItemProvider".into(),
                "registerHoverProvider".into(),
                "registerDefinitionProvider".into(),
                "registerReferenceProvider".into(),
                "registerDocumentSymbolProvider".into(),
                "registerCodeActionsProvider".into(),
                "registerCodeLensProvider".into(),
                "registerDocumentFormattingEditProvider".into(),
                "registerDocumentRangeFormattingEditProvider".into(),
                "registerOnTypeFormattingEditProvider".into(),
                "registerRenameProvider".into(),
                "registerSignatureHelpProvider".into(),
                "registerDocumentHighlightProvider".into(),
                "registerDocumentLinkProvider".into(),
                "registerColorProvider".into(),
                "registerFoldingRangeProvider".into(),
                "registerDeclarationProvider".into(),
                "registerTypeDefinitionProvider".into(),
                "registerImplementationProvider".into(),
                "registerSelectionRangeProvider".into(),
                "registerCallHierarchyProvider".into(),
                "registerTypeHierarchyProvider".into(),
                "registerInlayHintsProvider".into(),
                "registerInlineCompletionItemProvider".into(),
                "createDiagnosticCollection".into(),
                "setLanguageConfiguration".into(),
                "getDiagnostics".into(),
                "match".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Commands,
            methods: vec![
                "registerCommand".into(),
                "executeCommand".into(),
                "getCommands".into(),
                "registerTextEditorCommand".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Debug,
            methods: vec![
                "registerDebugConfigurationProvider".into(),
                "registerDebugAdapterDescriptorFactory".into(),
                "startDebugging".into(),
                "stopDebugging".into(),
                "addBreakpoints".into(),
                "removeBreakpoints".into(),
                "onDidStartDebugSession".into(),
                "onDidTerminateDebugSession".into(),
                "onDidChangeActiveDebugSession".into(),
                "onDidReceiveDebugSessionCustomEvent".into(),
                "onDidChangeBreakpoints".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Scm,
            methods: vec![
                "createSourceControl".into(),
                "registerSourceControlResourceGroup".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::Authentication,
            methods: vec!["registerAuthenticationProvider".into(), "getSession".into()],
        },
        ApiCapability {
            namespace: ApiNamespace::Tests,
            methods: vec!["createTestController".into(), "createTestRun".into()],
        },
        ApiCapability {
            namespace: ApiNamespace::TreeView,
            methods: vec!["createTreeView".into(), "registerTreeDataProvider".into()],
        },
        ApiCapability {
            namespace: ApiNamespace::Webview,
            methods: vec![
                "createWebviewPanel".into(),
                "registerWebviewViewProvider".into(),
            ],
        },
        ApiCapability {
            namespace: ApiNamespace::CustomEditors,
            methods: vec!["registerCustomEditorProvider".into()],
        },
        ApiCapability {
            namespace: ApiNamespace::FileDecorationProvider,
            methods: vec!["registerFileDecorationProvider".into()],
        },
        ApiCapability {
            namespace: ApiNamespace::SourceControl,
            methods: vec![
                "createSourceControl".into(),
                "registerSourceControlResourceGroup".into(),
            ],
        },
    ]
}

// ============================================================================
// Incoming API call dispatch
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VscodeApiCall {
    pub namespace: String,
    pub method: String,
    pub args: serde_json::Value,
    #[serde(default)]
    pub extension_id: Option<String>,
    #[serde(default)]
    pub request_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiCallResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub fn handle_api_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    let event_name = format!(
        "vscode-api:{}:{}",
        call.namespace.to_lowercase(),
        call.method
    );

    match call.namespace.as_str() {
        "window" => handle_window_call(app, call),
        "workspace" => handle_workspace_call(app, call),
        "languages" => handle_languages_call(app, call),
        "commands" => handle_commands_call(app, call),
        "debug" => handle_debug_call(app, call),
        _ => {
            info!(
                "Forwarding unhandled API call {}.{} as event: {}",
                call.namespace, call.method, event_name
            );
            let _ = app.emit(&event_name, &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}

// ============================================================================
// vscode.window
// ============================================================================

fn handle_window_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    match call.method.as_str() {
        "showInformationMessage" | "showWarningMessage" | "showErrorMessage" => {
            let severity = match call.method.as_str() {
                "showWarningMessage" => "warning",
                "showErrorMessage" => "error",
                _ => "info",
            };
            let _ = app.emit(
                "plugin:show-message",
                serde_json::json!({
                    "extensionId": call.extension_id,
                    "severity": severity,
                    "message": call.args.get(0).unwrap_or(&serde_json::Value::Null),
                    "actions": call.args.get(1).unwrap_or(&serde_json::Value::Array(vec![])),
                }),
            );
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "showQuickPick" => {
            let _ = app.emit("plugin:quick-pick", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "showInputBox" => {
            let _ = app.emit("plugin:input-box", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "createOutputChannel" => {
            let _ = app.emit("plugin:create-output-channel", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "createStatusBarItem" => {
            let _ = app.emit("plugin:create-status-bar-item", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "withProgress" => {
            let _ = app.emit("plugin:progress-start", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "createTreeView" | "registerTreeDataProvider" => {
            let _ = app.emit("plugin:tree-view-register", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "createWebviewPanel" | "registerWebviewViewProvider" => {
            let _ = app.emit("plugin:webview-register", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        _ => {
            let event = format!("vscode-api:window:{}", call.method);
            let _ = app.emit(&event, &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}

// ============================================================================
// vscode.workspace
// ============================================================================

fn handle_workspace_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    match call.method.as_str() {
        "getConfiguration" => {
            let _ = app.emit("plugin:get-configuration", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "openTextDocument" => {
            let _ = app.emit("plugin:open-document", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "applyEdit" => {
            let _ = app.emit("plugin:apply-workspace-edit", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "findFiles" => {
            let _ = app.emit("plugin:find-files", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "saveAll" => {
            let _ = app.emit("plugin:save-all", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "createFileSystemWatcher" => {
            let _ = app.emit("plugin:create-file-watcher", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        _ => {
            let event = format!("vscode-api:workspace:{}", call.method);
            let _ = app.emit(&event, &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}

// ============================================================================
// vscode.languages
// ============================================================================

fn handle_languages_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    let event = format!("vscode-api:languages:{}", call.method);
    let _ = app.emit(&event, &call.args);
    ApiCallResult {
        success: true,
        data: None,
        error: None,
    }
}

// ============================================================================
// vscode.commands
// ============================================================================

fn handle_commands_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    match call.method.as_str() {
        "registerCommand" => {
            let _ = app.emit("plugin:register-command", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "executeCommand" => {
            let _ = app.emit("plugin:execute-command", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        _ => {
            let event = format!("vscode-api:commands:{}", call.method);
            let _ = app.emit(&event, &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}

// ============================================================================
// vscode.debug
// ============================================================================

fn handle_debug_call(app: &AppHandle, call: &VscodeApiCall) -> ApiCallResult {
    match call.method.as_str() {
        "registerDebugConfigurationProvider" => {
            let _ = app.emit("plugin:debug-config-provider", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "startDebugging" => {
            let _ = app.emit("plugin:debug-start", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        "stopDebugging" => {
            let _ = app.emit("plugin:debug-stop", &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
        _ => {
            let event = format!("vscode-api:debug:{}", call.method);
            let _ = app.emit(&event, &call.args);
            ApiCallResult {
                success: true,
                data: None,
                error: None,
            }
        }
    }
}
