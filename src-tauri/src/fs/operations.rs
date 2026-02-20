//! File Operations - Core file read/write/delete operations
//!
//! This module contains all file CRUD operations as Tauri commands,
//! including reading, writing, copying, moving, and deleting files.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tracing::info;

use crate::fs::security::{
    validate_path_for_delete, validate_path_for_read, validate_path_for_write,
};
use crate::fs::types::DirectoryCache;

// ============================================================================
// File Read Operations
// ============================================================================

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_read(&file_path)?;

    if !validated_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !validated_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // Try reading as UTF-8 first, fall back to lossy conversion for non-UTF-8 files
    match fs::read_to_string(&validated_path).await {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::InvalidData => {
            // File is not valid UTF-8, try lossy conversion
            let bytes = fs::read(&validated_path)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?;
            Ok(String::from_utf8_lossy(&bytes).into_owned())
        }
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
pub async fn fs_read_file_binary(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_read(&file_path)?;

    if !validated_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let bytes = fs::read(&validated_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    use base64::{Engine, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(bytes))
}

// ============================================================================
// File Write Operations
// ============================================================================

#[tauri::command]
pub async fn fs_write_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_write(&file_path)?;

    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::write(&validated_path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    info!("Wrote file: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn fs_write_file_binary(
    app: AppHandle,
    path: String,
    content: String,
) -> Result<(), String> {
    use base64::{Engine, engine::general_purpose::STANDARD};

    let bytes = STANDARD
        .decode(&content)
        .map_err(|e| format!("Invalid base64 content: {}", e))?;

    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_write(&file_path)?;

    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::write(&validated_path, bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    info!("Wrote binary file: {}", path);
    Ok(())
}

// ============================================================================
// File Create/Delete Operations
// ============================================================================

#[tauri::command]
pub async fn fs_delete_file(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_delete(&file_path)?;

    if !validated_path.exists() {
        return Ok(());
    }

    if !validated_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    if let Some(parent) = validated_path.parent() {
        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::remove_file(&validated_path)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    info!("Deleted file: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn fs_create_file(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_write(&file_path)?;

    if validated_path.exists() {
        return Err(format!("File already exists: {}", path));
    }

    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::write(&validated_path, "")
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    info!("Created file: {}", path);
    Ok(())
}

// ============================================================================
// File Copy/Move/Rename Operations
// ============================================================================

#[tauri::command]
pub async fn fs_rename(app: AppHandle, old_path: String, new_path: String) -> Result<(), String> {
    let from = PathBuf::from(&old_path);
    let to = PathBuf::from(&new_path);

    // Validate paths to prevent traversal attacks
    let validated_from = validate_path_for_write(&from)?;
    let validated_to = validate_path_for_write(&to)?;

    if !validated_from.exists() {
        return Err(format!("Source does not exist: {}", old_path));
    }

    if validated_to.exists() {
        return Err(format!("Destination already exists: {}", new_path));
    }

    if let Some(parent) = validated_to.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    let cache = app.state::<Arc<DirectoryCache>>();
    if let Some(parent) = validated_from.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }
    if let Some(parent) = validated_to.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }
    cache.invalidate_prefix(&old_path);

    fs::rename(&validated_from, &validated_to)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;

    info!("Renamed {} to {}", old_path, new_path);
    Ok(())
}

#[tauri::command]
pub async fn fs_copy_file(
    app: AppHandle,
    source: String,
    destination: String,
) -> Result<(), String> {
    let from = PathBuf::from(&source);
    let to = PathBuf::from(&destination);

    // Validate paths to prevent traversal attacks
    let validated_from = validate_path_for_read(&from)?;
    let validated_to = validate_path_for_write(&to)?;

    if !validated_from.exists() {
        return Err(format!("Source file does not exist: {}", source));
    }

    if !validated_from.is_file() {
        return Err(format!("Source is not a file: {}", source));
    }

    if let Some(parent) = validated_to.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::copy(&validated_from, &validated_to)
        .await
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    info!("Copied {} to {}", source, destination);
    Ok(())
}

#[tauri::command]
pub async fn fs_move(app: AppHandle, source: String, destination: String) -> Result<(), String> {
    let from = PathBuf::from(&source);
    let to = PathBuf::from(&destination);

    // Validate paths to prevent traversal attacks
    let validated_from = validate_path_for_delete(&from)?;
    let validated_to = validate_path_for_write(&to)?;

    if !validated_from.exists() {
        return Err(format!("Source does not exist: {}", source));
    }

    if validated_to.exists() {
        return Err(format!("Destination already exists: {}", destination));
    }

    if let Some(parent) = validated_to.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    let cache = app.state::<Arc<DirectoryCache>>();
    if let Some(parent) = validated_from.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }
    if let Some(parent) = validated_to.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }
    cache.invalidate_prefix(&source);

    match fs::rename(&validated_from, &validated_to).await {
        Ok(_) => {}
        Err(_) => {
            if validated_from.is_file() {
                fs::copy(&validated_from, &validated_to)
                    .await
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
                fs::remove_file(&validated_from)
                    .await
                    .map_err(|e| format!("Failed to remove source: {}", e))?;
            } else {
                copy_dir_recursive(&validated_from, &validated_to).await?;
                fs::remove_dir_all(&validated_from)
                    .await
                    .map_err(|e| format!("Failed to remove source directory: {}", e))?;
            }
        }
    }

    info!("Moved {} to {}", source, destination);
    Ok(())
}

/// Recursively copy a directory
pub async fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let mut entries = fs::read_dir(src)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let entry_path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if entry_path.is_dir() {
            Box::pin(copy_dir_recursive(&entry_path, &dest_path)).await?;
        } else {
            fs::copy(&entry_path, &dest_path)
                .await
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

// ============================================================================
// Trash Operations
// ============================================================================

#[tauri::command]
pub async fn fs_trash(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_delete(&file_path)?;

    if !validated_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let cache = app.state::<Arc<DirectoryCache>>();
    if let Some(parent) = validated_path.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }
    if validated_path.is_dir() {
        cache.invalidate_prefix(&path);
    }

    trash::delete(&validated_path).map_err(|e| format!("Failed to trash: {}", e))?;

    info!("Trashed: {}", path);
    Ok(())
}

// ============================================================================
// Shell/Explorer Operations
// ============================================================================

#[tauri::command]
pub async fn fs_reveal_in_explorer(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        crate::process_utils::command("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        crate::process_utils::command("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = file_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path.clone());

        crate::process_utils::command("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    info!("Revealed in explorer: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn fs_open_with_default(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    info!("Opened with default app: {}", path);
    Ok(())
}

/// Open a path with the system shell or default application
/// This is an alias for fs_open_with_default for terminal link compatibility
#[tauri::command]
pub async fn shell_open(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open: {}", e))?;
    info!("Shell opened: {}", path);
    Ok(())
}
