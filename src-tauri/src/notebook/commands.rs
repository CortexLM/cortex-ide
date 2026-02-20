use super::types::{
    IpynbCell, IpynbKernelspecMeta, IpynbLanguageInfo, IpynbMetadata, IpynbNotebook,
    NotebookKernelEntry, html_escape, render_output_html, uuid_like_id,
};
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Manager, command};
use tracing::{error, info, warn};

// ===== ipynb Parsing & Saving Commands =====

/// Parse a .ipynb file into structured notebook data.
#[command]
pub async fn notebook_parse_ipynb(path: String) -> Result<IpynbNotebook, String> {
    info!("[Notebook] Parsing ipynb file: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let notebook = tokio::task::spawn_blocking(move || {
        serde_json::from_str::<IpynbNotebook>(&content)
            .map_err(|e| format!("Failed to parse ipynb JSON: {}", e))
    })
    .await
    .map_err(|e| format!("Parse task failed: {}", e))??;

    info!(
        "[Notebook] Parsed {} cells from {}",
        notebook.cells.len(),
        path
    );
    Ok(notebook)
}

/// Serialize notebook data and write to a .ipynb file.
#[command]
pub async fn notebook_save_ipynb(path: String, notebook: IpynbNotebook) -> Result<(), String> {
    info!("[Notebook] Saving ipynb file: {}", path);

    let json = tokio::task::spawn_blocking(move || {
        serde_json::to_string_pretty(&notebook)
            .map_err(|e| format!("Failed to serialize notebook: {}", e))
    })
    .await
    .map_err(|e| format!("Serialize task failed: {}", e))??;

    tokio::fs::write(&path, json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write ipynb file '{}': {}", path, e))?;

    info!("[Notebook] Saved ipynb file: {}", path);
    Ok(())
}

// ===== Export Commands =====

/// Export a notebook as an HTML document.
#[command]
pub async fn notebook_export_html(path: String) -> Result<String, String> {
    info!("[Notebook] Exporting notebook as HTML: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let html = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let title = notebook
            .metadata
            .extra
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Notebook");

        let mut body = String::new();

        for cell in &notebook.cells {
            let source = cell.source.join("");
            match cell.cell_type.as_str() {
                "markdown" => {
                    body.push_str("<div class=\"cell markdown-cell\">\n");
                    body.push_str(&html_escape(&source));
                    body.push_str("\n</div>\n");
                }
                "code" => {
                    body.push_str("<div class=\"cell code-cell\">\n");
                    if let Some(ec) = cell.execution_count {
                        body.push_str(&format!(
                            "<div class=\"execution-count\">In [{}]:</div>\n",
                            ec
                        ));
                    }
                    body.push_str("<pre><code>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</code></pre>\n");

                    if let Some(ref outputs) = cell.outputs {
                        for output in outputs {
                            render_output_html(&mut body, output);
                        }
                    }

                    body.push_str("</div>\n");
                }
                "raw" => {
                    body.push_str("<div class=\"cell raw-cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
                _ => {
                    body.push_str("<div class=\"cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
            }
        }

        let html = format!(
            "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>{}</title>\n<style>\n\
             body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}\n\
             .cell {{ margin-bottom: 16px; padding: 12px; border: 1px solid #e1e4e8; border-radius: 6px; }}\n\
             .code-cell pre {{ background: #f6f8fa; padding: 12px; border-radius: 4px; overflow-x: auto; }}\n\
             .execution-count {{ color: #6a737d; font-size: 12px; margin-bottom: 4px; }}\n\
             .output {{ margin-top: 8px; padding: 8px; background: #fafbfc; border-left: 3px solid #0366d6; }}\n\
             .output-error {{ border-left-color: #d73a49; background: #ffeef0; }}\n\
             .raw-cell pre {{ background: #f0f0f0; padding: 12px; }}\n\
             </style>\n</head>\n<body>\n{}\n</body>\n</html>",
            html_escape(title),
            body
        );

        Ok(html)
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))??;

    info!("[Notebook] HTML export complete for: {}", path);
    Ok(html)
}

/// Export a notebook as a Python script.
#[command]
pub async fn notebook_export_python(path: String) -> Result<String, String> {
    info!("[Notebook] Exporting notebook as Python script: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let script = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let mut parts: Vec<String> = Vec::new();
        parts.push("#!/usr/bin/env python3".to_string());
        parts.push(format!(
            "# Exported from: {}",
            notebook
                .metadata
                .extra
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Notebook")
        ));
        parts.push(String::new());

        for cell in &notebook.cells {
            let source = cell.source.join("");
            match cell.cell_type.as_str() {
                "code" => {
                    parts.push(source);
                    parts.push(String::new());
                }
                "markdown" => {
                    let commented: Vec<String> = source
                        .lines()
                        .map(|line| {
                            if line.is_empty() {
                                "#".to_string()
                            } else {
                                format!("# {}", line)
                            }
                        })
                        .collect();
                    parts.push(commented.join("\n"));
                    parts.push(String::new());
                }
                "raw" => {
                    let commented: Vec<String> = source
                        .lines()
                        .map(|line| {
                            if line.is_empty() {
                                "#".to_string()
                            } else {
                                format!("# {}", line)
                            }
                        })
                        .collect();
                    parts.push(commented.join("\n"));
                    parts.push(String::new());
                }
                _ => {}
            }
        }

        Ok(parts.join("\n"))
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))??;

    info!("[Notebook] Python export complete for: {}", path);
    Ok(script)
}

/// Export a notebook as PDF-ready HTML with print-friendly styles.
#[command]
pub async fn notebook_export_pdf(path: String) -> Result<String, String> {
    info!("[Notebook] Exporting notebook as PDF-ready HTML: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let html = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let title = notebook
            .metadata
            .extra
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Notebook");

        let mut body = String::new();

        for cell in &notebook.cells {
            let source = cell.source.join("");
            match cell.cell_type.as_str() {
                "markdown" => {
                    body.push_str("<div class=\"cell markdown-cell\">\n");
                    body.push_str(&html_escape(&source));
                    body.push_str("\n</div>\n");
                }
                "code" => {
                    body.push_str("<div class=\"cell code-cell\">\n");
                    if let Some(ec) = cell.execution_count {
                        body.push_str(&format!(
                            "<div class=\"execution-count\">In [{}]:</div>\n",
                            ec
                        ));
                    }
                    body.push_str("<pre><code>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</code></pre>\n");

                    if let Some(ref outputs) = cell.outputs {
                        for output in outputs {
                            render_output_html(&mut body, output);
                        }
                    }

                    body.push_str("</div>\n");
                }
                "raw" => {
                    body.push_str("<div class=\"cell raw-cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
                _ => {
                    body.push_str("<div class=\"cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
            }
        }

        let html = format!(
            "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>{}</title>\n<style>\n\
             body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}\n\
             .cell {{ margin-bottom: 16px; padding: 12px; border: 1px solid #e1e4e8; border-radius: 6px; page-break-inside: avoid; }}\n\
             .code-cell pre {{ background: #f6f8fa; padding: 12px; border-radius: 4px; overflow-x: auto; }}\n\
             .execution-count {{ color: #6a737d; font-size: 12px; margin-bottom: 4px; }}\n\
             .output {{ margin-top: 8px; padding: 8px; background: #fafbfc; border-left: 3px solid #0366d6; }}\n\
             .output-error {{ border-left-color: #d73a49; background: #ffeef0; }}\n\
             .raw-cell pre {{ background: #f0f0f0; padding: 12px; }}\n\
             @media print {{\n\
               body {{ padding: 0; margin: 0; max-width: 100%; }}\n\
               .cell {{ border: none; page-break-inside: avoid; break-inside: avoid; margin-bottom: 12px; }}\n\
               .code-cell pre {{ border: 1px solid #ddd; }}\n\
               .output {{ border-left: 2px solid #999; }}\n\
               @page {{ margin: 1.5cm; }}\n\
             }}\n\
             </style>\n</head>\n<body>\n{}\n</body>\n</html>",
            html_escape(title),
            body
        );

        Ok(html)
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))??;

    info!("[Notebook] PDF-ready HTML export complete for: {}", path);
    Ok(html)
}

// ===== Kernel Discovery =====

/// Discover available Jupyter kernels from system kernelspec locations
/// and the existing REPL kernel specs.
#[command]
pub async fn notebook_list_kernels(app: AppHandle) -> Result<Vec<NotebookKernelEntry>, String> {
    info!("[Notebook] Listing available kernels");

    let mut entries: Vec<NotebookKernelEntry> = Vec::new();

    // 1. Discover Jupyter kernelspecs from `jupyter --data-dir`
    match discover_jupyter_kernels().await {
        Ok(jupyter_entries) => {
            info!(
                "[Notebook] Found {} Jupyter kernelspecs",
                jupyter_entries.len()
            );
            entries.extend(jupyter_entries);
        }
        Err(e) => {
            warn!("[Notebook] Could not discover Jupyter kernels: {}", e);
        }
    }

    // 2. Include REPL kernel specs from the existing KernelManager
    let repl_state = app.state::<crate::app::REPLState>();
    let repl_specs = {
        let guard = repl_state
            .0
            .lock()
            .map_err(|_| "Failed to acquire REPL lock".to_string())?;
        match guard.as_ref() {
            Some(manager) => manager.list_kernel_specs(),
            None => Vec::new(),
        }
    };

    for spec in repl_specs {
        let already_listed = entries
            .iter()
            .any(|e| e.name == spec.id || e.display_name == spec.display_name);
        if !already_listed {
            entries.push(NotebookKernelEntry {
                name: spec.id,
                display_name: spec.display_name,
                language: spec.language,
                source: "repl".to_string(),
                executable: spec.executable,
            });
        }
    }

    info!("[Notebook] Total kernels found: {}", entries.len());
    Ok(entries)
}

/// Detect available kernels from the system, including probing common executable paths.
#[command]
pub async fn notebook_detect_kernels(app: AppHandle) -> Result<Vec<NotebookKernelEntry>, String> {
    info!("[Notebook] Detecting available kernels");

    let mut entries: Vec<NotebookKernelEntry> = Vec::new();

    // 1. Discover Jupyter kernelspecs from `jupyter --data-dir`
    match discover_jupyter_kernels().await {
        Ok(jupyter_entries) => {
            info!(
                "[Notebook] Found {} Jupyter kernelspecs",
                jupyter_entries.len()
            );
            entries.extend(jupyter_entries);
        }
        Err(e) => {
            warn!("[Notebook] Could not discover Jupyter kernels: {}", e);
        }
    }

    // 2. Include REPL kernel specs from the existing KernelManager
    let repl_state = app.state::<crate::app::REPLState>();
    let repl_specs = {
        let guard = repl_state
            .0
            .lock()
            .map_err(|_| "Failed to acquire REPL lock".to_string())?;
        match guard.as_ref() {
            Some(manager) => manager.list_kernel_specs(),
            None => Vec::new(),
        }
    };

    for spec in repl_specs {
        let already_listed = entries
            .iter()
            .any(|e| e.name == spec.id || e.display_name == spec.display_name);
        if !already_listed {
            entries.push(NotebookKernelEntry {
                name: spec.id,
                display_name: spec.display_name,
                language: spec.language,
                source: "repl".to_string(),
                executable: spec.executable,
            });
        }
    }

    // 3. Probe common executable paths for kernels even without Jupyter installed
    let probes: Vec<(&str, &str, &str)> = vec![
        ("python3", "Python 3", "python"),
        ("python", "Python", "python"),
        ("node", "Node.js", "javascript"),
    ];

    for (cmd, display, lang) in probes {
        let already_listed = entries
            .iter()
            .any(|e| e.name == cmd || e.executable.as_deref() == Some(cmd));
        if already_listed {
            continue;
        }

        let cmd_str = cmd.to_string();
        let probe_result = tokio::process::Command::new("which")
            .arg(&cmd_str)
            .output()
            .await;

        if let Ok(output) = probe_result {
            if output.status.success() {
                let exec_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                entries.push(NotebookKernelEntry {
                    name: cmd.to_string(),
                    display_name: display.to_string(),
                    language: lang.to_string(),
                    source: "detected".to_string(),
                    executable: Some(exec_path),
                });
            }
        }
    }

    info!("[Notebook] Total detected kernels: {}", entries.len());
    Ok(entries)
}

/// Discover Jupyter kernelspecs by running `jupyter --data-dir` and scanning
/// the kernels subdirectory, plus standard system locations.
async fn discover_jupyter_kernels() -> Result<Vec<NotebookKernelEntry>, String> {
    let mut kernel_dirs: Vec<std::path::PathBuf> = Vec::new();

    // 1. Try `jupyter --data-dir`
    if let Ok(output) = tokio::process::Command::new("jupyter")
        .arg("--data-dir")
        .output()
        .await
    {
        if output.status.success() {
            if let Ok(data_dir) = String::from_utf8(output.stdout) {
                let dir = std::path::PathBuf::from(data_dir.trim()).join("kernels");
                kernel_dirs.push(dir);
            }
        }
    }

    // 2. Standard locations
    if let Some(home) = dirs::home_dir() {
        // Linux: ~/.local/share/jupyter/kernels/
        kernel_dirs.push(home.join(".local/share/jupyter/kernels"));
        // macOS: ~/Library/Jupyter/kernels/
        kernel_dirs.push(home.join("Library/Jupyter/kernels"));
    }

    // 3. System-wide locations
    kernel_dirs.push(std::path::PathBuf::from("/usr/share/jupyter/kernels"));
    kernel_dirs.push(std::path::PathBuf::from("/usr/local/share/jupyter/kernels"));

    // 4. Conda environments
    if let Ok(output) = tokio::process::Command::new("conda")
        .args(["info", "--envs", "--json"])
        .output()
        .await
    {
        if output.status.success() {
            if let Ok(json_str) = String::from_utf8(output.stdout) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(envs) = val.get("envs").and_then(|v| v.as_array()) {
                        for env in envs {
                            if let Some(env_path) = env.as_str() {
                                kernel_dirs.push(
                                    std::path::PathBuf::from(env_path)
                                        .join("share/jupyter/kernels"),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    // Deduplicate directories
    kernel_dirs.sort();
    kernel_dirs.dedup();

    let entries =
        tokio::task::spawn_blocking(move || -> Result<Vec<NotebookKernelEntry>, String> {
            let mut results = Vec::new();
            let mut seen_names: std::collections::HashSet<String> =
                std::collections::HashSet::new();

            for kernels_dir in &kernel_dirs {
                let read_dir = match std::fs::read_dir(kernels_dir) {
                    Ok(rd) => rd,
                    Err(_) => continue,
                };

                for entry in read_dir.flatten() {
                    let kernel_dir = entry.path();
                    if !kernel_dir.is_dir() {
                        continue;
                    }

                    let kernel_json = kernel_dir.join("kernel.json");
                    if !kernel_json.exists() {
                        continue;
                    }

                    let content = match std::fs::read_to_string(&kernel_json) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let spec: serde_json::Value = match serde_json::from_str(&content) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };

                    let name = entry.file_name().to_string_lossy().to_string();

                    if seen_names.contains(&name) {
                        continue;
                    }
                    seen_names.insert(name.clone());

                    let display_name = spec
                        .get("display_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&name)
                        .to_string();

                    let language = spec
                        .get("language")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let executable = spec
                        .get("argv")
                        .and_then(|v| v.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    results.push(NotebookKernelEntry {
                        name,
                        display_name,
                        language,
                        source: "jupyter".to_string(),
                        executable,
                    });
                }
            }

            Ok(results)
        })
        .await
        .map_err(|e| format!("Kernel discovery task failed: {}", e))??;

    Ok(entries)
}

// ===== Cell Manipulation Commands =====

/// Split a cell's source at a given byte position, returning two parts.
#[command]
pub async fn notebook_cell_split(
    source: String,
    position: usize,
) -> Result<(String, String), String> {
    info!("[Notebook] Splitting cell source at position {}", position);

    let result = tokio::task::spawn_blocking(move || -> Result<(String, String), String> {
        if position > source.len() {
            return Err(format!(
                "Split position {} exceeds source length {}",
                position,
                source.len()
            ));
        }

        if !source.is_char_boundary(position) {
            return Err(format!(
                "Split position {} is not on a valid character boundary",
                position
            ));
        }

        let (left, right) = source.split_at(position);
        Ok((left.to_string(), right.to_string()))
    })
    .await
    .map_err(|e| format!("Cell split task failed: {}", e))??;

    Ok(result)
}

/// Join multiple cell sources together with an optional separator.
#[command]
pub async fn notebook_cell_join(
    sources: Vec<String>,
    separator: Option<String>,
) -> Result<String, String> {
    info!("[Notebook] Joining {} cell sources", sources.len());

    let sep = separator.unwrap_or_else(|| "\n".to_string());
    let joined = sources.join(&sep);

    Ok(joined)
}

/// Reorder cells in a notebook by providing the desired cell ID order.
#[command]
pub async fn notebook_reorder_cells(path: String, cell_order: Vec<String>) -> Result<(), String> {
    info!(
        "[Notebook] Reordering {} cells in {}",
        cell_order.len(),
        path
    );

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let json = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let mut notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let mut cell_map: HashMap<String, IpynbCell> = HashMap::new();
        for cell in notebook.cells.drain(..) {
            let id = cell.id.clone().unwrap_or_default();
            cell_map.insert(id, cell);
        }

        let mut reordered: Vec<IpynbCell> = Vec::with_capacity(cell_order.len());
        for id in &cell_order {
            match cell_map.remove(id) {
                Some(cell) => reordered.push(cell),
                None => {
                    return Err(format!("Cell with id '{}' not found in notebook", id));
                }
            }
        }

        // Append any remaining cells not in the order list
        for (_, cell) in cell_map {
            reordered.push(cell);
        }

        notebook.cells = reordered;

        serde_json::to_string_pretty(&notebook)
            .map_err(|e| format!("Failed to serialize notebook: {}", e))
    })
    .await
    .map_err(|e| format!("Reorder task failed: {}", e))??;

    tokio::fs::write(&path, json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write ipynb file '{}': {}", path, e))?;

    info!("[Notebook] Reordered cells in {}", path);
    Ok(())
}

/// Install a Jupyter kernel via `python -m ipykernel install --user`.
#[command]
pub async fn notebook_install_kernel(python_path: String) -> Result<String, String> {
    info!(
        "[Notebook] Installing ipykernel via: {} -m ipykernel install --user",
        python_path
    );

    let output = tokio::time::timeout(
        Duration::from_secs(60),
        tokio::process::Command::new(&python_path)
            .args(["-m", "ipykernel", "install", "--user"])
            .output(),
    )
    .await
    .map_err(|_| "Kernel installation timed out after 60 seconds".to_string())?
    .map_err(|e| format!("Failed to run ipykernel install: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        error!("[Notebook] ipykernel install failed: {}", stderr.trim());
        return Err(format!(
            "ipykernel install failed (exit code {:?}): {}",
            output.status.code(),
            stderr.trim()
        ));
    }

    info!("[Notebook] ipykernel installed successfully");
    Ok(format!("{}\n{}", stdout.trim(), stderr.trim())
        .trim()
        .to_string())
}

/// Create a new empty .ipynb notebook file.
#[command]
pub async fn notebook_create_notebook(
    path: String,
    language: Option<String>,
) -> Result<(), String> {
    let lang = language.unwrap_or_else(|| "python".to_string());
    info!("[Notebook] Creating new {} notebook at: {}", lang, path);

    let notebook = IpynbNotebook {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: IpynbMetadata {
            kernelspec: Some(IpynbKernelspecMeta {
                name: match lang.as_str() {
                    "python" => "python3".to_string(),
                    "javascript" => "node".to_string(),
                    _ => lang.clone(),
                },
                display_name: match lang.as_str() {
                    "python" => "Python 3".to_string(),
                    "javascript" => "Node.js".to_string(),
                    _ => lang.clone(),
                },
                language: Some(lang.clone()),
            }),
            language_info: Some(IpynbLanguageInfo {
                name: lang,
                ..Default::default()
            }),
            extra: Default::default(),
        },
        cells: vec![IpynbCell {
            cell_type: "code".to_string(),
            source: vec![String::new()],
            outputs: Some(Vec::new()),
            execution_count: None,
            metadata: serde_json::Value::Object(Default::default()),
            id: Some(format!("cell-{}", uuid_like_id())),
        }],
    };

    let json = serde_json::to_string_pretty(&notebook)
        .map_err(|e| format!("Failed to serialize notebook: {}", e))?;

    tokio::fs::write(&path, json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write notebook file '{}': {}", path, e))?;

    info!("[Notebook] Created new notebook at: {}", path);
    Ok(())
}
