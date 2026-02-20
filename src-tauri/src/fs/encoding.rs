//! File Encoding - Encoding detection and conversion
//!
//! This module provides file encoding detection, line ending detection,
//! and conversion utilities.

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::fs::types::DirectoryCache;

// ============================================================================
// Line Ending Detection and Conversion
// ============================================================================

/// Detect the line ending style of a file
#[tauri::command]
pub fn fs_detect_eol(path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Count different line ending types
    let crlf_count = content.matches("\r\n").count();
    // LF count is total \n minus the ones that are part of \r\n
    let lf_count = content.matches('\n').count().saturating_sub(crlf_count);
    // CR count is total \r minus the ones that are part of \r\n
    let cr_count = content.matches('\r').count().saturating_sub(crlf_count);

    let eol = if crlf_count > 0 && lf_count == 0 && cr_count == 0 {
        "CRLF"
    } else if lf_count > 0 && crlf_count == 0 && cr_count == 0 {
        "LF"
    } else if cr_count > 0 && crlf_count == 0 && lf_count == 0 {
        "CR"
    } else if crlf_count == 0 && lf_count == 0 && cr_count == 0 {
        // No line endings found (single line file or empty)
        // Default to LF on Unix, CRLF on Windows
        #[cfg(windows)]
        {
            "CRLF"
        }
        #[cfg(not(windows))]
        {
            "LF"
        }
    } else {
        "Mixed"
    };

    Ok(eol.to_string())
}

/// Convert line endings of a file to the specified style
#[tauri::command]
pub fn fs_convert_eol(path: String, target_eol: String) -> Result<(), String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Normalize to LF first by replacing all line endings
    let normalized = content
        .replace("\r\n", "\n") // CRLF -> LF
        .replace('\r', "\n"); // CR -> LF

    // Convert to target line ending
    let converted = match target_eol.as_str() {
        "CRLF" => normalized.replace('\n', "\r\n"),
        "CR" => normalized.replace('\n', "\r"),
        _ => normalized, // LF (default)
    };

    std::fs::write(&path, converted).map_err(|e| e.to_string())?;

    info!("Converted line endings of {} to {}", path, target_eol);
    Ok(())
}

// ============================================================================
// File Encoding Detection and Conversion
// ============================================================================

/// Detect the encoding of a file
#[tauri::command]
pub fn fs_detect_encoding(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Check for BOM first
    if let Some((encoding, _)) = encoding_rs::Encoding::for_bom(&bytes) {
        return Ok(encoding.name().to_string());
    }

    // Use chardetng for detection if no BOM
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);

    Ok(encoding.name().to_string())
}

/// Read a file with a specific encoding
#[tauri::command]
pub async fn fs_read_file_with_encoding(path: String, encoding: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let encoding_type =
        encoding_rs::Encoding::for_label(encoding.as_bytes()).unwrap_or(encoding_rs::UTF_8);

    let (content, _, had_errors) = encoding_type.decode(&bytes);

    if had_errors {
        warn!(
            "Encoding errors detected while reading file {} with encoding {}",
            path, encoding
        );
    }

    Ok(content.into_owned())
}

/// Write a file with a specific encoding
#[tauri::command]
pub async fn fs_write_file_with_encoding(
    app: AppHandle,
    path: String,
    content: String,
    encoding: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Invalidate cache
        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    let encoding_type =
        encoding_rs::Encoding::for_label(encoding.as_bytes()).unwrap_or(encoding_rs::UTF_8);

    let (bytes, _, had_errors) = encoding_type.encode(&content);

    if had_errors {
        warn!(
            "Encoding errors detected while writing file {} with encoding {}",
            path, encoding
        );
    }

    tokio::fs::write(&file_path, &*bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    info!("Wrote file with encoding {}: {}", encoding, path);
    Ok(())
}

/// Get list of supported encodings
#[tauri::command]
pub fn fs_get_supported_encodings() -> Vec<String> {
    vec![
        "UTF-8".to_string(),
        "UTF-16LE".to_string(),
        "UTF-16BE".to_string(),
        "windows-1252".to_string(),
        "ISO-8859-1".to_string(),
        "ISO-8859-2".to_string(),
        "ISO-8859-15".to_string(),
        "Shift_JIS".to_string(),
        "EUC-JP".to_string(),
        "ISO-2022-JP".to_string(),
        "GBK".to_string(),
        "gb18030".to_string(),
        "Big5".to_string(),
        "EUC-KR".to_string(),
        "KOI8-R".to_string(),
        "KOI8-U".to_string(),
        "macintosh".to_string(),
        "IBM866".to_string(),
        "windows-1250".to_string(),
        "windows-1251".to_string(),
        "windows-1253".to_string(),
        "windows-1254".to_string(),
        "windows-1255".to_string(),
        "windows-1256".to_string(),
        "windows-1257".to_string(),
        "windows-1258".to_string(),
    ]
}
