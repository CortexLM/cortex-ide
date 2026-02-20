//! Internationalization (i18n) module.
//!
//! Provides locale detection, available locale metadata, and Tauri commands
//! for the frontend i18n subsystem. Translations themselves live on the
//! frontend; this module handles system-level locale detection and
//! configuration plumbing.

use serde::{Deserialize, Serialize};
use tracing::info;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocaleInfo {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct I18nConfig {
    pub current_locale: String,
    pub available_locales: Vec<LocaleInfo>,
}

// ============================================================================
// Helpers
// ============================================================================

/// Detect the system locale from environment variables.
///
/// Checks `LANG` first, then `LC_ALL`. The raw value is normalised by
/// stripping any encoding suffix (e.g. `.UTF-8`) and region qualifier
/// (e.g. `_US`), yielding a bare language code such as `"en"` or `"fr"`.
/// Returns `"en"` when no environment variable is set or the value is
/// empty / `"C"` / `"POSIX"`.
pub fn detect_system_locale() -> String {
    let raw = std::env::var("LANG")
        .or_else(|_| std::env::var("LC_ALL"))
        .unwrap_or_default();

    parse_locale_code(&raw)
}

fn parse_locale_code(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "C" || trimmed == "POSIX" {
        return "en".to_string();
    }

    let without_encoding = trimmed.split('.').next().unwrap_or(trimmed);
    let language = without_encoding
        .split('_')
        .next()
        .unwrap_or(without_encoding);

    if language.is_empty() {
        "en".to_string()
    } else {
        language.to_lowercase()
    }
}

/// Returns the list of locales supported by the application.
pub fn get_available_locales() -> Vec<LocaleInfo> {
    vec![
        LocaleInfo {
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: "English".to_string(),
        },
        LocaleInfo {
            code: "fr".to_string(),
            name: "French".to_string(),
            native_name: "Français".to_string(),
        },
        LocaleInfo {
            code: "zh".to_string(),
            name: "Chinese".to_string(),
            native_name: "中文".to_string(),
        },
        LocaleInfo {
            code: "ja".to_string(),
            name: "Japanese".to_string(),
            native_name: "日本語".to_string(),
        },
        LocaleInfo {
            code: "es".to_string(),
            name: "Spanish".to_string(),
            native_name: "Español".to_string(),
        },
        LocaleInfo {
            code: "de".to_string(),
            name: "German".to_string(),
            native_name: "Deutsch".to_string(),
        },
    ]
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn i18n_detect_locale() -> Result<String, String> {
    let locale = detect_system_locale();
    info!(locale = %locale, "Detected system locale");
    Ok(locale)
}

#[tauri::command]
pub async fn i18n_get_config() -> Result<I18nConfig, String> {
    let current_locale = detect_system_locale();
    let available_locales = get_available_locales();
    info!(locale = %current_locale, count = available_locales.len(), "Built i18n config");
    Ok(I18nConfig {
        current_locale,
        available_locales,
    })
}

fn is_supported_locale(code: &str) -> bool {
    get_available_locales().iter().any(|l| l.code == code)
}

#[tauri::command]
pub async fn i18n_load_translations(locale: String) -> Result<serde_json::Value, String> {
    if !is_supported_locale(&locale) {
        return Err(format!("Unsupported locale: {}", locale));
    }
    info!(locale = %locale, "Loading translations (frontend-managed)");
    Ok(serde_json::json!({}))
}
