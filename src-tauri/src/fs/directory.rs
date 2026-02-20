//! Directory Operations - Directory CRUD and tree traversal
//!
//! This module contains directory operations including creation, deletion,
//! listing, and tree traversal with parallel processing.

use futures::stream::{FuturesUnordered, StreamExt};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::{info, warn};

use crate::fs::security::{validate_path_for_delete, validate_path_for_write};
use crate::fs::types::{
    BATCH_SIZE, CortexProject, DirectoryCache, FileEntry, FileMetadata, IoSemaphore,
};
use crate::fs::utils::{
    get_extension, is_hidden, parallel_sort_entries, should_ignore, system_time_to_unix,
};

// ============================================================================
// Directory Create/Delete Operations
// ============================================================================

#[tauri::command]
pub async fn fs_create_directory(app: AppHandle, path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_write(&dir_path)?;

    if validated_path.exists() {
        return Err(format!("Directory already exists: {}", path));
    }

    if let Some(parent) = validated_path.parent() {
        let cache = app.state::<Arc<DirectoryCache>>();
        cache.invalidate(&parent.to_string_lossy());
    }

    fs::create_dir_all(&validated_path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    info!("Created directory: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn fs_delete_directory(
    app: AppHandle,
    path: String,
    recursive: bool,
) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    // Validate path to prevent traversal attacks
    let validated_path = validate_path_for_delete(&dir_path)?;

    if !validated_path.exists() {
        return Ok(());
    }

    if !validated_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let cache = app.state::<Arc<DirectoryCache>>();
    cache.invalidate_prefix(&path);

    if let Some(parent) = validated_path.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }

    if recursive {
        fs::remove_dir_all(&validated_path)
            .await
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_dir(&validated_path)
            .await
            .map_err(|e| format!("Failed to delete directory (not empty?): {}", e))?;
    }

    info!("Deleted directory: {}", path);
    Ok(())
}

// ============================================================================
// Directory Listing Operations
// ============================================================================

/// Fetch metadata for a single path - used in parallel batch operations
async fn fetch_entry_metadata(
    path: PathBuf,
    semaphore: Arc<Semaphore>,
) -> Option<(PathBuf, std::fs::Metadata, bool)> {
    let _permit = semaphore.acquire().await.ok()?;

    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path_clone).ok()?;
        let is_symlink = std::fs::symlink_metadata(&path_clone)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false);
        Some((path_clone, metadata, is_symlink))
    })
    .await
    .ok()?
}

/// Read directory entries in parallel batches
pub async fn read_directory_parallel(
    dir_path: PathBuf,
    show_hidden: bool,
    include_ignored: bool,
    semaphore: Arc<Semaphore>,
) -> Result<Vec<FileEntry>, String> {
    let _permit = semaphore
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| format!("Semaphore error: {}", e))?;

    let raw_entries: Vec<PathBuf> = tokio::task::spawn_blocking(move || {
        let mut paths = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&dir_path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let entry_path = entry.path();

                let hidden = is_hidden(&name, &entry_path);
                let ignored = should_ignore(&name);

                if hidden && !show_hidden {
                    continue;
                }
                if ignored && !include_ignored {
                    continue;
                }

                paths.push(entry_path);
            }
        }
        paths
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    drop(_permit);

    let mut entries = Vec::with_capacity(raw_entries.len());

    for chunk in raw_entries.chunks(BATCH_SIZE) {
        let mut futures = FuturesUnordered::new();

        for path in chunk {
            let path = path.clone();
            let sem = Arc::clone(&semaphore);
            futures.push(fetch_entry_metadata(path, sem));
        }

        while let Some(result) = futures.next().await {
            if let Some((path, metadata, is_symlink)) = result {
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let is_dir = metadata.is_dir();
                let modified_at = metadata.modified().ok().and_then(system_time_to_unix);

                entries.push(FileEntry {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    is_hidden: is_hidden(&name, &path),
                    is_symlink,
                    size: if is_dir { None } else { Some(metadata.len()) },
                    modified_at,
                    extension: if is_dir { None } else { get_extension(&name) },
                    children: None,
                });
            }
        }
    }

    parallel_sort_entries(&mut entries);
    Ok(entries)
}

/// Build file tree with parallel recursive traversal using JoinSet
pub fn build_file_tree_parallel(
    path: PathBuf,
    depth: u32,
    show_hidden: bool,
    include_ignored: bool,
    semaphore: Arc<Semaphore>,
    cache: Arc<DirectoryCache>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<FileEntry, String>> + Send>> {
    Box::pin(async move {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        let path_clone = path.clone();
        let (metadata, is_symlink) = tokio::task::spawn_blocking(move || {
            let metadata = std::fs::metadata(&path_clone)?;
            let is_symlink = std::fs::symlink_metadata(&path_clone)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false);
            Ok::<_, std::io::Error>((metadata, is_symlink))
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

        let is_dir = metadata.is_dir();
        let modified_at = metadata.modified().ok().and_then(system_time_to_unix);

        let mut entry = FileEntry {
            name: name.clone(),
            path: path.to_string_lossy().to_string(),
            is_dir,
            is_hidden: is_hidden(&name, &path),
            is_symlink,
            size: if is_dir { None } else { Some(metadata.len()) },
            modified_at,
            extension: if is_dir { None } else { get_extension(&name) },
            children: None,
        };

        if is_dir && depth > 0 {
            let cache_key = path.to_string_lossy().to_string();

            let immediate_children = if let Some(cached) = cache.get(&cache_key) {
                cached
            } else {
                let children = read_directory_parallel(
                    path.clone(),
                    show_hidden,
                    include_ignored,
                    Arc::clone(&semaphore),
                )
                .await?;
                cache.insert(cache_key.clone(), children.clone());
                children
            };

            if depth == 1 {
                entry.children = Some(immediate_children);
            } else {
                let mut join_set: JoinSet<Result<FileEntry, String>> = JoinSet::new();

                for child in immediate_children {
                    if child.is_dir {
                        let child_path = PathBuf::from(&child.path);
                        let sem = Arc::clone(&semaphore);
                        let cache_clone = Arc::clone(&cache);

                        join_set.spawn(build_file_tree_parallel(
                            child_path,
                            depth - 1,
                            show_hidden,
                            include_ignored,
                            sem,
                            cache_clone,
                        ));
                    } else {
                        let child_owned = child;
                        join_set.spawn(async move { Ok(child_owned) });
                    }
                }

                let mut children = Vec::new();
                while let Some(result) = join_set.join_next().await {
                    match result {
                        Ok(Ok(child_entry)) => children.push(child_entry),
                        Ok(Err(e)) => warn!("Failed to read child: {}", e),
                        Err(e) => warn!("Task join error: {}", e),
                    }
                }

                parallel_sort_entries(&mut children);
                entry.children = Some(children);
            }
        }

        Ok(entry)
    })
}

#[tauri::command]
pub async fn fs_list_directory(
    app: AppHandle,
    path: String,
    show_hidden: bool,
    include_ignored: bool,
) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let cache = app.state::<Arc<DirectoryCache>>();
    let cache_key = format!("{}:{}:{}", path, show_hidden, include_ignored);

    if let Some(cached) = cache.get(&cache_key) {
        return Ok(cached);
    }

    let semaphore = app.state::<Arc<IoSemaphore>>();
    let entries =
        read_directory_parallel(dir_path, show_hidden, include_ignored, semaphore.get()).await?;

    cache.insert(cache_key, entries.clone());
    Ok(entries)
}

#[tauri::command]
pub async fn fs_get_file_tree(
    app: AppHandle,
    path: String,
    depth: u32,
    show_hidden: bool,
    include_ignored: bool,
) -> Result<FileEntry, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let semaphore = app.state::<Arc<IoSemaphore>>();
    let cache = app.state::<Arc<DirectoryCache>>();

    build_file_tree_parallel(
        dir_path,
        depth,
        show_hidden,
        include_ignored,
        semaphore.get(),
        Arc::clone(cache.inner()),
    )
    .await
}

/// Get a shallow file tree (immediate children only) for lazy loading UI
#[tauri::command]
pub async fn fs_get_file_tree_shallow(
    app: AppHandle,
    path: String,
    show_hidden: bool,
    include_ignored: bool,
) -> Result<FileEntry, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir_path.to_string_lossy().to_string());

    let path_clone = dir_path.clone();
    let (metadata, is_symlink) = tokio::task::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path_clone)?;
        let is_symlink = std::fs::symlink_metadata(&path_clone)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false);
        Ok::<_, std::io::Error>((metadata, is_symlink))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let is_dir = metadata.is_dir();
    let modified_at = metadata.modified().ok().and_then(system_time_to_unix);

    let mut entry = FileEntry {
        name: name.clone(),
        path: path.clone(),
        is_dir,
        is_hidden: is_hidden(&name, &dir_path),
        is_symlink,
        size: if is_dir { None } else { Some(metadata.len()) },
        modified_at,
        extension: if is_dir { None } else { get_extension(&name) },
        children: None,
    };

    if is_dir {
        let cache = app.state::<Arc<DirectoryCache>>();
        let cache_key = format!("{}:{}:{}", path, show_hidden, include_ignored);

        let children = if let Some(cached) = cache.get(&cache_key) {
            cached
        } else {
            let semaphore = app.state::<Arc<IoSemaphore>>();
            let entries =
                read_directory_parallel(dir_path, show_hidden, include_ignored, semaphore.get())
                    .await?;
            cache.insert(cache_key, entries.clone());
            entries
        };

        let shallow_children: Vec<FileEntry> = children
            .into_iter()
            .map(|mut child| {
                child.children = if child.is_dir { Some(Vec::new()) } else { None };
                child
            })
            .collect();

        entry.children = Some(shallow_children);
    }

    Ok(entry)
}

/// Prefetch directories in background to warm the cache
#[tauri::command]
pub async fn fs_prefetch_directory(
    app: AppHandle,
    paths: Vec<String>,
    show_hidden: bool,
    include_ignored: bool,
) -> Result<(), String> {
    let semaphore = app.state::<Arc<IoSemaphore>>();
    let cache = app.state::<Arc<DirectoryCache>>();

    let mut join_set: JoinSet<()> = JoinSet::new();

    for path in paths {
        let dir_path = PathBuf::from(&path);
        if !dir_path.exists() || !dir_path.is_dir() {
            continue;
        }

        let cache_key = format!("{}:{}:{}", path, show_hidden, include_ignored);

        if cache.get(&cache_key).is_some() {
            continue;
        }

        let sem = semaphore.get();
        let cache_clone = Arc::clone(cache.inner());

        join_set.spawn(async move {
            match read_directory_parallel(dir_path.clone(), show_hidden, include_ignored, sem).await
            {
                Ok(entries) => {
                    cache_clone.insert(cache_key, entries);
                }
                Err(e) => {
                    warn!("Failed to prefetch {}: {}", dir_path.display(), e);
                }
            }
        });
    }

    while join_set.join_next().await.is_some() {}

    Ok(())
}

/// Clear the directory cache
#[tauri::command]
pub async fn fs_clear_cache(app: AppHandle) -> Result<(), String> {
    let cache = app.state::<Arc<DirectoryCache>>();
    cache.clear();
    info!("Directory cache cleared");
    Ok(())
}

// ============================================================================
// Metadata Operations
// ============================================================================

#[tauri::command]
pub async fn fs_get_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let path_clone = file_path.clone();
    let (metadata, symlink_metadata) = tokio::task::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path_clone)?;
        let symlink_metadata = std::fs::symlink_metadata(&path_clone)?;
        Ok::<_, std::io::Error>((metadata, symlink_metadata))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileMetadata {
        path,
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: symlink_metadata.file_type().is_symlink(),
        is_hidden: is_hidden(&name, &file_path),
        size: metadata.len(),
        modified_at: metadata.modified().ok().and_then(system_time_to_unix),
        created_at: metadata.created().ok().and_then(system_time_to_unix),
        accessed_at: metadata.accessed().ok().and_then(system_time_to_unix),
        readonly: metadata.permissions().readonly(),
    })
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).exists())
}

#[tauri::command]
pub async fn fs_is_file(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).is_file())
}

#[tauri::command]
pub async fn fs_is_directory(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).is_dir())
}

// ============================================================================
// Directory Path Helpers
// ============================================================================

#[tauri::command]
pub fn fs_get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
pub fn fs_get_documents_dir() -> Result<String, String> {
    dirs::document_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine documents directory".to_string())
}

#[tauri::command]
pub fn fs_get_desktop_dir() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine desktop directory".to_string())
}

/// Get the default Cortex projects directory based on OS.
/// Windows: Documents\Cortex\Projects
/// macOS/Linux: ~/Documents/Cortex/Projects (or ~/Cortex/Projects if Documents doesn't exist)
#[tauri::command]
pub fn fs_get_default_projects_dir() -> Result<String, String> {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .ok_or("Could not determine documents directory")?;

    let projects_dir = base.join("Cortex").join("Projects");
    Ok(projects_dir.to_string_lossy().to_string())
}

/// Create a new project directory in the default Cortex projects folder.
/// Returns the full path to the created project.
#[tauri::command]
pub fn fs_create_project(name: String) -> Result<String, String> {
    // Validate project name
    let name = name.trim();
    if name.is_empty() || name.len() > 100 {
        return Err("Project name must be 1-100 characters".to_string());
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' || c == '.')
    {
        return Err(
            "Project name can only contain letters, numbers, spaces, dots, dashes and underscores"
                .to_string(),
        );
    }

    // Get default projects dir
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .ok_or("Could not determine documents directory")?;

    let projects_dir = base.join("Cortex").join("Projects");
    let project_path = projects_dir.join(name);

    // Check if already exists
    if project_path.exists() {
        return Err(format!("Project '{}' already exists", name));
    }

    // Create directories
    std::fs::create_dir_all(&project_path)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    info!("Created new project at: {}", project_path.to_string_lossy());
    Ok(project_path.to_string_lossy().to_string())
}

/// List all projects in the Cortex projects directory.
#[tauri::command]
pub fn fs_list_cortex_projects() -> Result<Vec<CortexProject>, String> {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .ok_or("Could not determine documents directory")?;

    let projects_dir = base.join("Cortex").join("Projects");

    // If the directory doesn't exist yet, return empty list
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    let entries = std::fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let modified_at = path
                .metadata()
                .and_then(|m| m.modified())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0)
                })
                .unwrap_or(0);

            projects.push(CortexProject {
                name,
                path: path.to_string_lossy().to_string(),
                modified_at,
            });
        }
    }

    // Sort by modified_at descending (newest first)
    projects.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(projects)
}
