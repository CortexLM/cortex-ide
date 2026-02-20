//! System Specifications Module
//!
//! Provides system information retrieval for the About dialog,
//! including OS, CPU, memory, GPU, and application details.

use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

/// Complete system specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSpecs {
    /// Application version
    pub app_version: String,
    /// Operating system name
    pub os_name: String,
    /// Operating system version
    pub os_version: String,
    /// System architecture
    pub architecture: String,
    /// Total system memory in bytes
    pub total_memory: u64,
    /// Used system memory in bytes
    pub used_memory: u64,
    /// Available system memory in bytes
    pub available_memory: u64,
    /// CPU information
    pub cpu_info: CpuInfo,
    /// GPU information (if available)
    pub gpu_info: Option<String>,
    /// List of installed extensions
    pub installed_extensions: Vec<ExtensionInfo>,
    /// Build type (debug/release)
    pub build_type: String,
}

/// CPU information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuInfo {
    /// CPU brand/model name
    pub brand: String,
    /// Number of physical cores
    pub core_count: usize,
    /// Current CPU usage percentage (0-100)
    pub usage: f32,
    /// CPU frequency in MHz
    pub frequency: u64,
}

/// Extension information for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionInfo {
    /// Extension name
    pub name: String,
    /// Extension version
    pub version: String,
    /// Whether extension is enabled
    pub enabled: bool,
}

/// Live system metrics for real-time updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveMetrics {
    /// Current CPU usage percentage (0-100)
    pub cpu_usage: f32,
    /// Used memory in bytes
    pub used_memory: u64,
    /// Available memory in bytes
    pub available_memory: u64,
    /// Memory usage percentage (0-100)
    pub memory_percent: f32,
}

/// State for managing live metrics subscription
pub struct LiveMetricsState {
    pub active: AtomicBool,
}

impl LiveMetricsState {
    pub fn new() -> Self {
        Self {
            active: AtomicBool::new(false),
        }
    }

    /// Stop live metrics collection
    pub fn stop(&self) {
        self.active.store(false, Ordering::Relaxed);
    }
}

impl Default for LiveMetricsState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the operating system name
fn get_os_name() -> String {
    #[cfg(target_os = "windows")]
    {
        "Windows".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "macOS".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "Linux".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        env::consts::OS.to_string()
    }
}

/// Get the operating system version
fn get_os_version() -> String {
    System::os_version().unwrap_or_else(|| "Unknown".to_string())
}

/// Attempt to get GPU information
fn get_gpu_info() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, we can try to get GPU info from wmic
        match crate::process_utils::command("wmic")
            .args(["path", "win32_VideoController", "get", "name"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let gpu_name = stdout
                    .lines()
                    .skip(1)
                    .find(|line| !line.trim().is_empty())
                    .map(|s| s.trim().to_string());
                gpu_name
            }
            Err(_) => None,
        }
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, use system_profiler
        match crate::process_utils::command("system_profiler")
            .args(["SPDisplaysDataType", "-json"])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    json.get("SPDisplaysDataType")
                        .and_then(|displays| displays.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|display| display.get("sppci_model"))
                        .and_then(|model| model.as_str())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, try lspci for GPU info
        match crate::process_utils::command("lspci").output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout
                    .lines()
                    .find(|line| line.contains("VGA") || line.contains("3D"))
                    .map(|line| line.split(':').nth(2).unwrap_or(line).trim().to_string())
            }
            Err(_) => None,
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Get list of installed extensions from the extensions manager
fn get_installed_extensions(app: &AppHandle) -> Vec<ExtensionInfo> {
    use crate::extensions::ExtensionsState;

    if let Some(state) = app.try_state::<ExtensionsState>() {
        let guard = state.0.lock();
        return guard
            .extensions
            .values()
            .map(|ext| ExtensionInfo {
                name: ext.manifest.name.clone(),
                version: ext.manifest.version.clone(),
                enabled: ext.enabled,
            })
            .collect();
    }
    Vec::new()
}

/// Format bytes as human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Get complete system specifications
#[tauri::command]
pub async fn get_system_specs(app: AppHandle) -> Result<SystemSpecs, String> {
    info!("Fetching system specifications");

    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    // Give the system time to gather CPU metrics
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_all();

    let app_version = env!("CARGO_PKG_VERSION").to_string();

    let cpu_info = CpuInfo {
        brand: sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().to_string())
            .unwrap_or_else(|| "Unknown".to_string()),
        core_count: sys.cpus().len(),
        usage: sys.global_cpu_usage(),
        frequency: sys.cpus().first().map(|cpu| cpu.frequency()).unwrap_or(0),
    };

    let installed_extensions = get_installed_extensions(&app);

    let specs = SystemSpecs {
        app_version,
        os_name: get_os_name(),
        os_version: get_os_version(),
        architecture: env::consts::ARCH.to_string(),
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        available_memory: sys.available_memory(),
        cpu_info,
        gpu_info: get_gpu_info(),
        installed_extensions,
        build_type: if cfg!(debug_assertions) {
            "Debug".to_string()
        } else {
            "Release".to_string()
        },
    };

    Ok(specs)
}

/// Get current live metrics (CPU and memory usage)
#[tauri::command]
pub async fn get_live_metrics() -> Result<LiveMetrics, String> {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    // Give the system time to gather CPU metrics
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_all();

    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let available_memory = sys.available_memory();

    let memory_percent = if total_memory > 0 {
        (used_memory as f32 / total_memory as f32) * 100.0
    } else {
        0.0
    };

    Ok(LiveMetrics {
        cpu_usage: sys.global_cpu_usage(),
        used_memory,
        available_memory,
        memory_percent,
    })
}

/// Start streaming live metrics updates
#[tauri::command]
pub async fn start_live_metrics(app: AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<Arc<LiveMetricsState>>()
        .ok_or("LiveMetricsState not found")?;

    // If already active, don't start another loop
    if state.active.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let state_clone = state.inner().clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );

        while state_clone.active.load(Ordering::SeqCst) {
            // Refresh system info
            sys.refresh_cpu_all();
            sys.refresh_memory();

            let total_memory = sys.total_memory();
            let used_memory = sys.used_memory();
            let available_memory = sys.available_memory();

            let memory_percent = if total_memory > 0 {
                (used_memory as f32 / total_memory as f32) * 100.0
            } else {
                0.0
            };

            let metrics = LiveMetrics {
                cpu_usage: sys.global_cpu_usage(),
                used_memory,
                available_memory,
                memory_percent,
            };

            if app_clone
                .emit("system_specs:live_metrics", &metrics)
                .is_err()
            {
                break;
            }

            // Update every second
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }

        state_clone.active.store(false, Ordering::SeqCst);
    });

    Ok(())
}

/// Stop streaming live metrics updates
#[tauri::command]
pub async fn stop_live_metrics(app: AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<Arc<LiveMetricsState>>()
        .ok_or("LiveMetricsState not found")?;

    state.active.store(false, Ordering::SeqCst);
    Ok(())
}

/// Format system specs as a string for clipboard copying
#[tauri::command]
pub async fn format_system_specs_for_clipboard(app: AppHandle) -> Result<String, String> {
    let specs = get_system_specs(app).await?;

    let mut output = String::new();

    output.push_str(&format!("Cortex: v{}", specs.app_version));
    if specs.build_type == "Debug" {
        output.push_str(" (Debug)");
    }
    output.push('\n');

    output.push_str(&format!("OS: {} {}\n", specs.os_name, specs.os_version));
    output.push_str(&format!("Architecture: {}\n", specs.architecture));
    output.push_str(&format!(
        "Memory: {} total\n",
        format_bytes(specs.total_memory)
    ));
    output.push_str(&format!(
        "CPU: {} ({} cores)\n",
        specs.cpu_info.brand, specs.cpu_info.core_count
    ));

    if let Some(gpu) = &specs.gpu_info {
        output.push_str(&format!("GPU: {}\n", gpu));
    }

    if !specs.installed_extensions.is_empty() {
        output.push_str("\nInstalled Extensions:\n");
        for ext in &specs.installed_extensions {
            let status = if ext.enabled { "enabled" } else { "disabled" };
            output.push_str(&format!("  - {} v{} ({})\n", ext.name, ext.version, status));
        }
    }

    Ok(output)
}
