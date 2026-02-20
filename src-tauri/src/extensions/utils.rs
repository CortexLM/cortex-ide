//! Utility functions for the extension system.
//!
//! This module contains helper functions used across the extension system.

use std::fs;
use std::path::PathBuf;

/// Get the extensions directory path (internal helper)
pub fn extensions_directory_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cortex")
        .join("extensions")
}

/// Recursively copy a directory
pub fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Extract a zip package to a directory
pub fn extract_zip_package(
    zip_path: &std::path::Path,
    target_dir: &std::path::Path,
) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    fs::create_dir_all(target_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            let mut outfile =
                fs::File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)).ok();
            }
        }
    }

    Ok(())
}

/// Find the extension root directory (contains extension.json)
pub fn find_extension_root(dir: &std::path::Path) -> Result<std::path::PathBuf, String> {
    // Check if extension.json is at the root
    if dir.join("extension.json").exists() {
        return Ok(dir.to_path_buf());
    }

    // Check one level deep (common for GitHub releases)
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("extension.json").exists() {
                return Ok(path);
            }
        }
    }

    Err("Could not find extension.json in the package".to_string())
}
