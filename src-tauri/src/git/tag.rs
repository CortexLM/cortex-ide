//! Git tag operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::{find_repo, get_repo_root};
use super::types::GitTag;

// ============================================================================
// Tag Commands
// ============================================================================

/// List all tags in the repository
#[tauri::command]
pub async fn git_list_tags(path: String) -> Result<Vec<GitTag>, String> {
    tokio::task::spawn_blocking(move || git_list_tags_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_list_tags_sync(path: &str) -> Result<Vec<GitTag>, String> {
    let repo = find_repo(path)?;
    let mut tags = Vec::new();

    let tag_names = repo
        .tag_names(None)
        .map_err(|e| format!("Failed to get tags: {}", e))?;

    for tag_name in tag_names.iter().flatten() {
        let ref_name = format!("refs/tags/{}", tag_name);

        if let Ok(reference) = repo.find_reference(&ref_name) {
            let target_oid = reference
                .target()
                .ok_or_else(|| format!("Tag {} has no target", tag_name))?;

            // Try to peel to tag object (for annotated tags)
            let tag_info = if let Ok(tag_obj) = repo.find_tag(target_oid) {
                // Annotated tag
                let tagger = tag_obj.tagger();
                let date = tagger.as_ref().map(|t| {
                    chrono::DateTime::from_timestamp(t.when().seconds(), 0)
                        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
                        .unwrap_or_default()
                });

                let commit_sha = tag_obj
                    .target()
                    .map(|t| t.id().to_string())
                    .unwrap_or_else(|_| target_oid.to_string());

                GitTag {
                    name: tag_name.to_string(),
                    message: tag_obj.message().map(|s| s.to_string()),
                    tagger: tagger.and_then(|t| t.name().map(|s| s.to_string())),
                    date,
                    commit_sha,
                    is_annotated: true,
                }
            } else {
                // Lightweight tag - points directly to a commit
                let commit_sha = reference
                    .peel_to_commit()
                    .map(|c| c.id().to_string())
                    .unwrap_or_else(|_| target_oid.to_string());

                GitTag {
                    name: tag_name.to_string(),
                    message: None,
                    tagger: None,
                    date: None,
                    commit_sha,
                    is_annotated: false,
                }
            };

            tags.push(tag_info);
        }
    }

    // Sort tags by name (descending, so newer versions appear first)
    tags.sort_by(|a, b| b.name.cmp(&a.name));

    Ok(tags)
}

/// Create a new tag (lightweight or annotated)
#[tauri::command]
pub async fn git_create_tag(
    path: String,
    name: String,
    message: Option<String>,
    target: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        // Get the target commit (default to HEAD)
        let target_oid = if let Some(ref target_ref) = target {
            repo.revparse_single(target_ref)
                .map_err(|e| format!("Failed to find target '{}': {}", target_ref, e))?
                .id()
        } else {
            repo.head()
                .map_err(|e| format!("Failed to get HEAD: {}", e))?
                .target()
                .ok_or_else(|| "HEAD has no target".to_string())?
        };

        let target_commit = repo
            .find_object(target_oid, None)
            .map_err(|e| format!("Failed to find target object: {}", e))?;

        if let Some(msg) = message {
            // Create annotated tag
            let signature = repo
                .signature()
                .map_err(|e| format!("Failed to get signature: {}", e))?;

            repo.tag(&name, &target_commit, &signature, &msg, false)
                .map_err(|e| format!("Failed to create annotated tag: {}", e))?;

            info!("Created annotated tag: {} -> {}", name, target_oid);
        } else {
            // Create lightweight tag
            repo.tag_lightweight(&name, &target_commit, false)
                .map_err(|e| format!("Failed to create lightweight tag: {}", e))?;

            info!("Created lightweight tag: {} -> {}", name, target_oid);
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Create an annotated tag with explicit tagger information
#[tauri::command]
pub async fn git_create_annotated_tag(
    path: String,
    name: String,
    message: String,
    tagger_name: Option<String>,
    tagger_email: Option<String>,
    target: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let target_oid = if let Some(ref target_ref) = target {
            repo.revparse_single(target_ref)
                .map_err(|e| format!("Failed to find target '{}': {}", target_ref, e))?
                .id()
        } else {
            repo.head()
                .map_err(|e| format!("Failed to get HEAD: {}", e))?
                .target()
                .ok_or_else(|| "HEAD has no target".to_string())?
        };

        let target_obj = repo
            .find_object(target_oid, None)
            .map_err(|e| format!("Failed to find target object: {}", e))?;

        let signature = if let (Some(name), Some(email)) = (&tagger_name, &tagger_email) {
            git2::Signature::now(name, email)
                .map_err(|e| format!("Failed to create signature: {}", e))?
        } else {
            repo.signature()
                .map_err(|e| format!("Failed to get default signature: {}", e))?
        };

        repo.tag(&name, &target_obj, &signature, &message, false)
            .map_err(|e| format!("Failed to create annotated tag: {}", e))?;

        info!("Created annotated tag '{}' with message: {}", name, message);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Delete a tag
#[tauri::command]
pub async fn git_delete_tag(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        // Find and delete the tag reference
        let ref_name = format!("refs/tags/{}", name);
        let mut reference = repo
            .find_reference(&ref_name)
            .map_err(|e| format!("Tag '{}' not found: {}", name, e))?;

        reference
            .delete()
            .map_err(|e| format!("Failed to delete tag '{}': {}", name, e))?;

        info!("Deleted tag: {}", name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Push a tag to remote
#[tauri::command]
pub async fn git_push_tag(
    path: String,
    name: String,
    remote: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());
        let tag_ref = format!("refs/tags/{}", name);

        let output = git_command_with_timeout(&["push", &remote_name, &tag_ref], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to push tag '{}': {}", name, stderr));
        }

        info!("Pushed tag '{}' to remote '{}'", name, remote_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Delete a tag from remote
#[tauri::command]
pub async fn git_delete_remote_tag(
    path: String,
    name: String,
    remote: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());
        let tag_ref = format!("refs/tags/{}", name);

        let output = git_command_with_timeout(
            &["push", &remote_name, "--delete", &tag_ref],
            repo_root_path,
        )?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Failed to delete remote tag '{}': {}",
                name, stderr
            ));
        }

        info!("Deleted tag '{}' from remote '{}'", name, remote_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Checkout a tag (creates detached HEAD)
#[tauri::command]
pub async fn git_checkout_tag(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let tag_ref = format!("tags/{}", name);

        let output = git_command_with_timeout(&["checkout", &tag_ref], repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to checkout tag '{}': {}", name, stderr));
        }

        info!("Checked out tag: {}", name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
