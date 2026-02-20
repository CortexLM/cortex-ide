//! Debug adapter resolution and command building

use anyhow::Result;

use super::types::DebugSessionConfig;

/// Get the debug adapter command for a given type
pub fn get_adapter_command(config: &DebugSessionConfig) -> Result<(String, Vec<String>)> {
    // If custom adapter path is provided, use it
    if let Some(adapter_path) = &config.adapter_path {
        let args = config.adapter_args.clone().unwrap_or_default();
        return Ok((adapter_path.clone(), args));
    }

    // Determine command based on adapter type
    match config.type_.to_lowercase().as_str() {
        "node" | "pwa-node" | "node2" => resolve_node_adapter(),
        "python" | "debugpy" => Ok((
            "python".to_string(),
            vec!["-m".to_string(), "debugpy.adapter".to_string()],
        )),
        "go" | "delve" => Ok(("dlv".to_string(), vec!["dap".to_string()])),
        "lldb" | "codelldb" => resolve_lldb_adapter(),
        "cppdbg" | "cppvsdbg" => resolve_cpp_adapter(),
        "rust" => {
            // For Rust, prefer codelldb, fallback to lldb
            get_adapter_command(&DebugSessionConfig {
                type_: "lldb".to_string(),
                ..config.clone()
            })
        }
        other => {
            anyhow::bail!(
                "Unknown debug adapter type: '{}'. Supported types: node, python, go, lldb, cppdbg, rust. \
                 For other adapters, please provide 'adapterPath' in the configuration.",
                other
            )
        }
    }
}

/// Resolve Node.js debug adapter
fn resolve_node_adapter() -> Result<(String, Vec<String>)> {
    // Try to find js-debug or node-debug adapter
    // First check common VS Code extension locations
    let possible_adapters = [
        // VS Code's js-debug extension (most common)
        dirs::home_dir()
            .map(|h| h.join(".vscode/extensions"))
            .and_then(|ext_dir| {
                std::fs::read_dir(&ext_dir).ok().and_then(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .find(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .starts_with("ms-vscode.js-debug-")
                        })
                        .map(|e| e.path().join("src/dapDebugServer.js"))
                })
            }),
        // VS Code Insiders
        dirs::home_dir()
            .map(|h| h.join(".vscode-insiders/extensions"))
            .and_then(|ext_dir| {
                std::fs::read_dir(&ext_dir).ok().and_then(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .find(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .starts_with("ms-vscode.js-debug-")
                        })
                        .map(|e| e.path().join("src/dapDebugServer.js"))
                })
            }),
    ];

    for adapter_path in possible_adapters.into_iter().flatten() {
        if adapter_path.exists() {
            return Ok((
                "node".to_string(),
                vec![adapter_path.to_string_lossy().to_string()],
            ));
        }
    }

    // Fallback to using node --inspect with a wrapper approach
    // This provides basic debugging but isn't full DAP
    anyhow::bail!(
        "Could not find Node.js debug adapter. Please install VS Code's 'JavaScript Debugger' extension, \
         or provide a custom adapter path in the configuration."
    )
}

/// Resolve LLDB/codelldb debug adapter
fn resolve_lldb_adapter() -> Result<(String, Vec<String>)> {
    // Try to find codelldb or lldb-vscode
    let possible_adapters = [
        // codelldb from VS Code
        dirs::home_dir()
            .map(|h| h.join(".vscode/extensions"))
            .and_then(|ext_dir| {
                std::fs::read_dir(&ext_dir).ok().and_then(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .find(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .starts_with("vadimcn.vscode-lldb-")
                        })
                        .map(|e| e.path().join("adapter/codelldb"))
                })
            }),
    ];

    for adapter_path in possible_adapters.into_iter().flatten() {
        if adapter_path.exists() {
            return Ok((adapter_path.to_string_lossy().to_string(), vec![]));
        }
    }

    // Try system-installed lldb-vscode
    Ok(("lldb-vscode".to_string(), vec![]))
}

/// Resolve C++ debug adapter
fn resolve_cpp_adapter() -> Result<(String, Vec<String>)> {
    // For C++ debugging via cpptools
    let possible_adapters = [dirs::home_dir()
        .map(|h| h.join(".vscode/extensions"))
        .and_then(|ext_dir| {
            std::fs::read_dir(&ext_dir).ok().and_then(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .find(|e| {
                        e.file_name()
                            .to_string_lossy()
                            .starts_with("ms-vscode.cpptools-")
                    })
                    .map(|e| {
                        #[cfg(target_os = "windows")]
                        {
                            e.path().join("debugAdapters/vsdbg/bin/vsdbg.exe")
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            e.path().join("debugAdapters/bin/OpenDebugAD7")
                        }
                    })
            })
        })];

    for adapter_path in possible_adapters.into_iter().flatten() {
        if adapter_path.exists() {
            return Ok((adapter_path.to_string_lossy().to_string(), vec![]));
        }
    }

    anyhow::bail!(
        "Could not find C++ debug adapter. Please install VS Code's 'C/C++' extension, \
         or provide a custom adapter path."
    )
}
