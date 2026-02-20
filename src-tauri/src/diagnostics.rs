//! Diagnostics module for aggregating and managing diagnostics from multiple sources.
//!
//! This module provides:
//! - Aggregation of diagnostics from LSP servers, task problem matchers, and build output
//! - Filtering by severity, source, and file pattern
//! - File-grouped diagnostic retrieval
//! - Real-time diagnostic event emission to frontend
//! - Diagnostic summary computation

use std::collections::HashMap;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};
use tracing::{error, info};

/// Diagnostic severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

/// Diagnostic source types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSource {
    Lsp,
    Typescript,
    Eslint,
    Build,
    Task,
    Custom,
}

/// Diagnostic position in a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticPosition {
    pub line: u32,
    pub character: u32,
}

/// Diagnostic range in a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRange {
    pub start: DiagnosticPosition,
    pub end: DiagnosticPosition,
}

/// A unified diagnostic from any source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedDiagnostic {
    pub uri: String,
    pub range: DiagnosticRange,
    pub severity: DiagnosticSeverity,
    pub source: DiagnosticSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_name: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

/// Summary of diagnostic counts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiagnosticSummary {
    pub error_count: u32,
    pub warning_count: u32,
    pub information_count: u32,
    pub hint_count: u32,
    pub total_count: u32,
}

/// Result of a diagnostics refresh operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshResult {
    pub success: bool,
    pub message: String,
    pub summary: DiagnosticSummary,
}

/// Filter criteria for diagnostics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiagnosticFilter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<Vec<DiagnosticSeverity>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Vec<DiagnosticSource>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_pattern: Option<String>,
}

/// Diagnostics grouped by file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiagnostics {
    pub uri: String,
    pub diagnostics: Vec<UnifiedDiagnostic>,
    pub error_count: u32,
    pub warning_count: u32,
}

/// State for managing aggregated diagnostics
pub struct DiagnosticsState {
    diagnostics: Mutex<HashMap<String, Vec<UnifiedDiagnostic>>>,
    build_diagnostics: Mutex<HashMap<String, Vec<UnifiedDiagnostic>>>,
    task_diagnostics: Mutex<HashMap<String, Vec<UnifiedDiagnostic>>>,
}

impl DiagnosticsState {
    pub fn new() -> Self {
        Self {
            diagnostics: Mutex::new(HashMap::new()),
            build_diagnostics: Mutex::new(HashMap::new()),
            task_diagnostics: Mutex::new(HashMap::new()),
        }
    }

    fn compute_summary(diagnostics: &[UnifiedDiagnostic]) -> DiagnosticSummary {
        let mut summary = DiagnosticSummary::default();
        for diag in diagnostics {
            match diag.severity {
                DiagnosticSeverity::Error => summary.error_count += 1,
                DiagnosticSeverity::Warning => summary.warning_count += 1,
                DiagnosticSeverity::Information => summary.information_count += 1,
                DiagnosticSeverity::Hint => summary.hint_count += 1,
            }
        }
        summary.total_count = summary.error_count
            + summary.warning_count
            + summary.information_count
            + summary.hint_count;
        summary
    }

    fn all_diagnostics(&self) -> Vec<UnifiedDiagnostic> {
        let mut all = Vec::new();
        for diags in self.diagnostics.lock().values() {
            all.extend(diags.iter().cloned());
        }
        for diags in self.build_diagnostics.lock().values() {
            all.extend(diags.iter().cloned());
        }
        for diags in self.task_diagnostics.lock().values() {
            all.extend(diags.iter().cloned());
        }
        all
    }

    fn filter_diagnostics(
        diagnostics: &[UnifiedDiagnostic],
        filter: &DiagnosticFilter,
    ) -> Vec<UnifiedDiagnostic> {
        diagnostics
            .iter()
            .filter(|d| {
                if let Some(severities) = &filter.severity {
                    if !severities.contains(&d.severity) {
                        return false;
                    }
                }
                if let Some(sources) = &filter.source {
                    if !sources.contains(&d.source) {
                        return false;
                    }
                }
                if let Some(pattern) = &filter.file_pattern {
                    if !d.uri.contains(pattern) {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    fn group_by_file(diagnostics: &[UnifiedDiagnostic]) -> Vec<FileDiagnostics> {
        let mut grouped: HashMap<String, Vec<UnifiedDiagnostic>> = HashMap::new();
        for diag in diagnostics {
            grouped
                .entry(diag.uri.clone())
                .or_default()
                .push(diag.clone());
        }

        let mut result: Vec<FileDiagnostics> = grouped
            .into_iter()
            .map(|(uri, diags)| {
                let error_count = diags
                    .iter()
                    .filter(|d| d.severity == DiagnosticSeverity::Error)
                    .count() as u32;
                let warning_count = diags
                    .iter()
                    .filter(|d| d.severity == DiagnosticSeverity::Warning)
                    .count() as u32;
                FileDiagnostics {
                    uri,
                    diagnostics: diags,
                    error_count,
                    warning_count,
                }
            })
            .collect();

        result.sort_by(|a, b| {
            b.error_count
                .cmp(&a.error_count)
                .then(b.warning_count.cmp(&a.warning_count))
        });
        result
    }
}

impl Default for DiagnosticsState {
    fn default() -> Self {
        Self::new()
    }
}

/// Refresh diagnostics from all sources.
///
/// Aggregates diagnostics from all stored sources, computes summary,
/// and emits events to frontend.
#[tauri::command]
pub async fn diagnostics_refresh(
    app: AppHandle,
    diag_state: State<'_, DiagnosticsState>,
) -> Result<RefreshResult, String> {
    info!("Refreshing diagnostics from all sources");

    let all = diag_state.all_diagnostics();
    let summary = DiagnosticsState::compute_summary(&all);

    let grouped = DiagnosticsState::group_by_file(&all);
    if let Err(e) = app.emit("diagnostics:refreshed", &summary) {
        error!("Failed to emit diagnostics refresh event: {}", e);
    }
    if let Err(e) = app.emit("diagnostics:updated", &grouped) {
        error!("Failed to emit diagnostics updated event: {}", e);
    }

    Ok(RefreshResult {
        success: true,
        message: format!(
            "Refreshed diagnostics: {} errors, {} warnings, {} total",
            summary.error_count, summary.warning_count, summary.total_count
        ),
        summary,
    })
}

/// Get the current diagnostic summary.
#[tauri::command]
pub async fn diagnostics_get_summary(
    diag_state: State<'_, DiagnosticsState>,
) -> Result<DiagnosticSummary, String> {
    let all = diag_state.all_diagnostics();
    Ok(DiagnosticsState::compute_summary(&all))
}

/// Get diagnostics grouped by file.
#[tauri::command]
pub async fn diagnostics_get_by_file(
    diag_state: State<'_, DiagnosticsState>,
    filter: Option<DiagnosticFilter>,
) -> Result<Vec<FileDiagnostics>, String> {
    let all = diag_state.all_diagnostics();
    let filtered = match filter {
        Some(f) => DiagnosticsState::filter_diagnostics(&all, &f),
        None => all,
    };
    Ok(DiagnosticsState::group_by_file(&filtered))
}

/// Get diagnostics for a specific file.
#[tauri::command]
pub async fn diagnostics_get_for_file(
    diag_state: State<'_, DiagnosticsState>,
    uri: String,
) -> Result<Vec<UnifiedDiagnostic>, String> {
    let all = diag_state.all_diagnostics();
    Ok(all.into_iter().filter(|d| d.uri == uri).collect())
}

/// Filter diagnostics by criteria.
#[tauri::command]
pub async fn diagnostics_filter(
    diag_state: State<'_, DiagnosticsState>,
    filter: DiagnosticFilter,
) -> Result<Vec<UnifiedDiagnostic>, String> {
    let all = diag_state.all_diagnostics();
    Ok(DiagnosticsState::filter_diagnostics(&all, &filter))
}

/// Push LSP diagnostics into the aggregated state.
#[tauri::command]
pub async fn diagnostics_push_lsp(
    app: AppHandle,
    diag_state: State<'_, DiagnosticsState>,
    uri: String,
    server_name: String,
    diagnostics: Vec<UnifiedDiagnostic>,
) -> Result<(), String> {
    {
        let mut stored = diag_state.diagnostics.lock();
        stored.insert(format!("{}:{}", server_name, uri), diagnostics);
    }

    let all = diag_state.all_diagnostics();
    let summary = DiagnosticsState::compute_summary(&all);
    if let Err(e) = app.emit("diagnostics:summary", &summary) {
        error!("Failed to emit diagnostics summary: {}", e);
    }

    Ok(())
}

/// Add build diagnostics from task output or build process.
#[tauri::command]
pub async fn diagnostics_add_build(
    app: AppHandle,
    diag_state: State<'_, DiagnosticsState>,
    uri: String,
    diagnostics: Vec<UnifiedDiagnostic>,
) -> Result<(), String> {
    {
        let mut build_diags = diag_state.build_diagnostics.lock();
        build_diags.insert(uri, diagnostics);
    }

    let all = diag_state.all_diagnostics();
    let summary = DiagnosticsState::compute_summary(&all);

    if let Err(e) = app.emit("diagnostics:refreshed", &summary) {
        error!("Failed to emit diagnostics event: {}", e);
    }

    Ok(())
}

/// Clear build diagnostics.
#[tauri::command]
pub async fn diagnostics_clear_build(
    app: AppHandle,
    diag_state: State<'_, DiagnosticsState>,
) -> Result<(), String> {
    diag_state.build_diagnostics.lock().clear();

    let all = diag_state.all_diagnostics();
    let summary = DiagnosticsState::compute_summary(&all);

    if let Err(e) = app.emit("diagnostics:refreshed", &summary) {
        error!("Failed to emit diagnostics event: {}", e);
    }

    Ok(())
}

/// Write content to a file (kept for backward compatibility).
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                error!("Failed to create parent directory: {}", e);
                format!("Failed to create directory: {}", e)
            })?;
        }
    }

    std::fs::write(&path, content).map_err(|e| {
        error!("Failed to write file {}: {}", path, e);
        format!("Failed to write file: {}", e)
    })?;

    info!("Successfully wrote file: {}", path);
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn make_diag(
        uri: &str,
        severity: DiagnosticSeverity,
        source: DiagnosticSource,
        msg: &str,
    ) -> UnifiedDiagnostic {
        UnifiedDiagnostic {
            uri: uri.to_string(),
            range: DiagnosticRange {
                start: DiagnosticPosition {
                    line: 0,
                    character: 0,
                },
                end: DiagnosticPosition {
                    line: 0,
                    character: 10,
                },
            },
            severity,
            source,
            source_name: None,
            message: msg.to_string(),
            code: None,
        }
    }

    #[test]
    fn test_diagnostic_summary_computation() {
        let diagnostics = vec![
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            ),
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Lsp,
                "w1",
            ),
            make_diag(
                "file:///b.rs",
                DiagnosticSeverity::Hint,
                DiagnosticSource::Lsp,
                "h1",
            ),
        ];

        let summary = DiagnosticsState::compute_summary(&diagnostics);
        assert_eq!(summary.error_count, 1);
        assert_eq!(summary.warning_count, 1);
        assert_eq!(summary.hint_count, 1);
        assert_eq!(summary.information_count, 0);
        assert_eq!(summary.total_count, 3);
    }

    #[test]
    fn test_diagnostic_filtering_by_severity() {
        let diagnostics = vec![
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            ),
            make_diag(
                "file:///b.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Build,
                "w1",
            ),
        ];

        let filter = DiagnosticFilter {
            severity: Some(vec![DiagnosticSeverity::Error]),
            source: None,
            file_pattern: None,
        };
        let filtered = DiagnosticsState::filter_diagnostics(&diagnostics, &filter);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].message, "e1");
    }

    #[test]
    fn test_diagnostic_filtering_by_source() {
        let diagnostics = vec![
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            ),
            make_diag(
                "file:///b.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Build,
                "w1",
            ),
        ];

        let filter = DiagnosticFilter {
            severity: None,
            source: Some(vec![DiagnosticSource::Build]),
            file_pattern: None,
        };
        let filtered = DiagnosticsState::filter_diagnostics(&diagnostics, &filter);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].message, "w1");
    }

    #[test]
    fn test_diagnostic_filtering_by_file_pattern() {
        let diagnostics = vec![
            make_diag(
                "file:///src/main.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            ),
            make_diag(
                "file:///src/lib.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Lsp,
                "w1",
            ),
        ];

        let filter = DiagnosticFilter {
            severity: None,
            source: None,
            file_pattern: Some("main".to_string()),
        };
        let filtered = DiagnosticsState::filter_diagnostics(&diagnostics, &filter);
        assert_eq!(filtered.len(), 1);
    }

    #[test]
    fn test_group_by_file() {
        let diagnostics = vec![
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            ),
            make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Lsp,
                "w1",
            ),
            make_diag(
                "file:///b.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Lsp,
                "w2",
            ),
        ];

        let grouped = DiagnosticsState::group_by_file(&diagnostics);
        assert_eq!(grouped.len(), 2);
        assert_eq!(grouped[0].uri, "file:///a.rs");
        assert_eq!(grouped[0].error_count, 1);
        assert_eq!(grouped[0].warning_count, 1);
        assert_eq!(grouped[0].diagnostics.len(), 2);
    }

    #[test]
    fn test_diagnostics_state_new() {
        let state = DiagnosticsState::new();
        assert!(state.diagnostics.lock().is_empty());
        assert!(state.build_diagnostics.lock().is_empty());
        assert!(state.task_diagnostics.lock().is_empty());
    }

    #[test]
    fn test_all_diagnostics_aggregation() {
        let state = DiagnosticsState::new();
        state.diagnostics.lock().insert(
            "lsp:file:///a.rs".to_string(),
            vec![make_diag(
                "file:///a.rs",
                DiagnosticSeverity::Error,
                DiagnosticSource::Lsp,
                "e1",
            )],
        );
        state.build_diagnostics.lock().insert(
            "file:///b.rs".to_string(),
            vec![make_diag(
                "file:///b.rs",
                DiagnosticSeverity::Warning,
                DiagnosticSource::Build,
                "w1",
            )],
        );

        let all = state.all_diagnostics();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn diagnostic_summary_default_all_zeros() {
        let summary = DiagnosticSummary::default();
        assert_eq!(summary.error_count, 0);
        assert_eq!(summary.warning_count, 0);
        assert_eq!(summary.information_count, 0);
        assert_eq!(summary.hint_count, 0);
        assert_eq!(summary.total_count, 0);
    }

    #[test]
    fn diagnostic_summary_serialization() {
        let summary = DiagnosticSummary {
            error_count: 3,
            warning_count: 5,
            information_count: 1,
            hint_count: 2,
            total_count: 11,
        };
        let json = serde_json::to_string(&summary).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["error_count"], 3);
        assert_eq!(parsed["warning_count"], 5);
        assert_eq!(parsed["total_count"], 11);
    }

    #[test]
    fn diagnostic_severity_serde() {
        let variants = vec![
            (DiagnosticSeverity::Error, r#""error""#),
            (DiagnosticSeverity::Warning, r#""warning""#),
            (DiagnosticSeverity::Information, r#""information""#),
            (DiagnosticSeverity::Hint, r#""hint""#),
        ];
        for (variant, expected) in variants {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, expected);
            let deserialized: DiagnosticSeverity = serde_json::from_str(&json).unwrap();
            let re_json = serde_json::to_string(&deserialized).unwrap();
            assert_eq!(re_json, expected);
        }
    }

    #[test]
    fn diagnostic_source_serde() {
        let variants = vec![
            (DiagnosticSource::Lsp, r#""lsp""#),
            (DiagnosticSource::Typescript, r#""typescript""#),
            (DiagnosticSource::Eslint, r#""eslint""#),
            (DiagnosticSource::Build, r#""build""#),
            (DiagnosticSource::Task, r#""task""#),
            (DiagnosticSource::Custom, r#""custom""#),
        ];
        for (variant, expected) in variants {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, expected);
            let deserialized: DiagnosticSource = serde_json::from_str(&json).unwrap();
            let re_json = serde_json::to_string(&deserialized).unwrap();
            assert_eq!(re_json, expected);
        }
    }

    #[test]
    fn diagnostic_position_construction_and_serde() {
        let pos = DiagnosticPosition {
            line: 10,
            character: 5,
        };
        let json = serde_json::to_string(&pos).unwrap();
        let deserialized: DiagnosticPosition = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.line, 10);
        assert_eq!(deserialized.character, 5);
    }

    #[test]
    fn diagnostic_position_zero_values() {
        let pos = DiagnosticPosition {
            line: 0,
            character: 0,
        };
        let json = serde_json::to_string(&pos).unwrap();
        let deserialized: DiagnosticPosition = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.line, 0);
        assert_eq!(deserialized.character, 0);
    }

    #[test]
    fn diagnostic_range_construction_and_serde() {
        let range = DiagnosticRange {
            start: DiagnosticPosition {
                line: 1,
                character: 0,
            },
            end: DiagnosticPosition {
                line: 1,
                character: 10,
            },
        };
        let json = serde_json::to_string(&range).unwrap();
        let deserialized: DiagnosticRange = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.start.line, 1);
        assert_eq!(deserialized.end.character, 10);
    }

    #[test]
    fn unified_diagnostic_full_serde() {
        let diag = UnifiedDiagnostic {
            uri: "file:///test.rs".to_string(),
            range: DiagnosticRange {
                start: DiagnosticPosition {
                    line: 5,
                    character: 3,
                },
                end: DiagnosticPosition {
                    line: 5,
                    character: 15,
                },
            },
            severity: DiagnosticSeverity::Error,
            source: DiagnosticSource::Lsp,
            source_name: Some("rust-analyzer".to_string()),
            message: "unused variable".to_string(),
            code: Some("E0001".to_string()),
        };
        let json = serde_json::to_string(&diag).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["uri"], "file:///test.rs");
        assert_eq!(parsed["severity"], "error");
        assert_eq!(parsed["source"], "lsp");
        assert_eq!(parsed["source_name"], "rust-analyzer");
        assert_eq!(parsed["message"], "unused variable");
        assert_eq!(parsed["code"], "E0001");

        let deserialized: UnifiedDiagnostic = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uri, "file:///test.rs");
        assert_eq!(deserialized.message, "unused variable");
    }

    #[test]
    fn unified_diagnostic_optional_fields_none() {
        let diag = UnifiedDiagnostic {
            uri: "file:///a.rs".to_string(),
            range: DiagnosticRange {
                start: DiagnosticPosition {
                    line: 0,
                    character: 0,
                },
                end: DiagnosticPosition {
                    line: 0,
                    character: 1,
                },
            },
            severity: DiagnosticSeverity::Warning,
            source: DiagnosticSource::Eslint,
            source_name: None,
            message: "msg".to_string(),
            code: None,
        };
        let json = serde_json::to_string(&diag).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("source_name").is_none());
        assert!(parsed.get("code").is_none());
    }

    #[test]
    fn refresh_result_construction_and_serde() {
        let result = RefreshResult {
            success: true,
            message: "All good".to_string(),
            summary: DiagnosticSummary {
                error_count: 1,
                warning_count: 2,
                information_count: 0,
                hint_count: 0,
                total_count: 3,
            },
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: RefreshResult = serde_json::from_str(&json).unwrap();
        assert!(deserialized.success);
        assert_eq!(deserialized.message, "All good");
        assert_eq!(deserialized.summary.error_count, 1);
        assert_eq!(deserialized.summary.total_count, 3);
    }

    #[test]
    fn refresh_result_failure() {
        let result = RefreshResult {
            success: false,
            message: "Failed".to_string(),
            summary: DiagnosticSummary::default(),
        };
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: RefreshResult = serde_json::from_str(&json).unwrap();
        assert!(!deserialized.success);
        assert_eq!(deserialized.summary.total_count, 0);
    }
}
