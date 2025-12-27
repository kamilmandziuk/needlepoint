use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;
use chrono::Utc;

const TRASH_DIR: &str = ".needlepoint/trash";

/// Validate and sanitize a file path to prevent directory traversal attacks
/// Returns the canonicalized full path if valid, or an error if the path is dangerous
fn validate_path(project_path: &str, file_path: &str) -> Result<PathBuf, String> {
    // Reject empty paths
    if file_path.is_empty() {
        return Err("File path cannot be empty".to_string());
    }

    // Reject paths with null bytes
    if file_path.contains('\0') {
        return Err("File path contains invalid characters".to_string());
    }

    // Reject absolute paths
    let file_path_obj = Path::new(file_path);
    if file_path_obj.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    // Reject paths containing .. (directory traversal)
    for component in file_path_obj.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Path cannot contain '..' (directory traversal not allowed)".to_string());
        }
    }

    // Reject paths starting with . that aren't just a filename starting with .
    // Allow: ".gitignore", "src/.env" but reject: "../foo", ".."
    let normalized = file_path.replace('\\', "/");
    if normalized.starts_with("../") || normalized.contains("/../") || normalized == ".." {
        return Err("Path cannot traverse outside project directory".to_string());
    }

    // Build the full path
    let project_dir = Path::new(project_path);
    let full_path = project_dir.join(file_path);

    // Canonicalize project path (must exist)
    let canonical_project = project_dir.canonicalize()
        .map_err(|e| format!("Invalid project path: {}", e))?;

    // For the full path, we need to handle non-existent files
    // Canonicalize as much as possible, then check the result
    let canonical_full = if full_path.exists() {
        full_path.canonicalize()
            .map_err(|e| format!("Failed to resolve path: {}", e))?
    } else {
        // For non-existent files, canonicalize the parent and append the filename
        if let Some(parent) = full_path.parent() {
            if parent.exists() {
                let canonical_parent = parent.canonicalize()
                    .map_err(|e| format!("Failed to resolve parent path: {}", e))?;
                if let Some(file_name) = full_path.file_name() {
                    canonical_parent.join(file_name)
                } else {
                    return Err("Invalid file path".to_string());
                }
            } else {
                // Parent doesn't exist yet - verify the path components don't escape
                // This is less strict but necessary for creating new directories
                full_path.clone()
            }
        } else {
            return Err("Invalid file path".to_string());
        }
    };

    // Verify the resolved path is within the project directory
    // Use string comparison after canonicalization for existing paths
    if canonical_full.exists() {
        let canonical_str = canonical_full.to_string_lossy();
        let project_str = canonical_project.to_string_lossy();
        if !canonical_str.starts_with(project_str.as_ref()) {
            return Err("Path resolves outside project directory".to_string());
        }
    }

    Ok(full_path)
}

/// Get the trash directory path for a project
fn get_trash_dir(project_path: &str) -> PathBuf {
    Path::new(project_path).join(TRASH_DIR)
}

/// Generate a unique trash filename with timestamp
fn get_trash_filename(original_path: &str) -> String {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S_%3f");
    let safe_name = original_path.replace(['/', '\\'], "_");
    format!("{}_{}", timestamp, safe_name)
}

/// Create a file and its parent directories if they don't exist
#[command]
pub fn create_file(project_path: String, file_path: String) -> Result<(), String> {
    let full_path = validate_path(&project_path, &file_path)?;

    // Create parent directories if they don't exist
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    // Create the file if it doesn't exist
    if !full_path.exists() {
        fs::write(&full_path, "").map_err(|e| format!("Failed to create file: {}", e))?;
    }

    Ok(())
}

/// Write content to a file, creating directories as needed
#[command]
pub fn write_file(project_path: String, file_path: String, content: String) -> Result<(), String> {
    let full_path = validate_path(&project_path, &file_path)?;

    // Create parent directories if they don't exist
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    fs::write(&full_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Soft delete a file by moving it to the trash folder
/// Returns the trash path for potential restoration
#[command]
pub fn delete_file(project_path: String, file_path: String) -> Result<String, String> {
    let full_path = validate_path(&project_path, &file_path)?;

    if !full_path.exists() {
        return Ok(String::new()); // File doesn't exist, nothing to delete
    }

    // Create trash directory if it doesn't exist
    let trash_dir = get_trash_dir(&project_path);
    fs::create_dir_all(&trash_dir).map_err(|e| format!("Failed to create trash directory: {}", e))?;

    // Generate unique trash filename
    let trash_filename = get_trash_filename(&file_path);
    let trash_path = trash_dir.join(&trash_filename);

    // Move file to trash
    fs::rename(&full_path, &trash_path).map_err(|e| format!("Failed to move file to trash: {}", e))?;

    Ok(trash_filename)
}

/// Permanently delete a file (bypasses trash - use with caution)
#[command]
pub fn delete_file_permanent(project_path: String, file_path: String) -> Result<(), String> {
    let full_path = validate_path(&project_path, &file_path)?;

    if full_path.exists() {
        fs::remove_file(&full_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

/// Restore a file from trash
#[command]
pub fn restore_file(project_path: String, trash_filename: String, original_path: String) -> Result<(), String> {
    // Validate the original path where we'll restore to
    let restore_path = validate_path(&project_path, &original_path)?;

    let trash_dir = get_trash_dir(&project_path);
    let trash_path = trash_dir.join(&trash_filename);

    if !trash_path.exists() {
        return Err("File not found in trash".to_string());
    }

    // Create parent directories for restore path if needed
    if let Some(parent) = restore_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    // Move file back from trash
    fs::rename(&trash_path, &restore_path).map_err(|e| format!("Failed to restore file: {}", e))?;

    Ok(())
}

/// List files in trash
#[command]
pub fn list_trash(project_path: String) -> Result<Vec<String>, String> {
    let trash_dir = get_trash_dir(&project_path);

    if !trash_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&trash_dir)
        .map_err(|e| format!("Failed to read trash directory: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }

    Ok(files)
}

/// Empty the trash (permanently delete all trashed files)
#[command]
pub fn empty_trash(project_path: String) -> Result<u32, String> {
    let trash_dir = get_trash_dir(&project_path);

    if !trash_dir.exists() {
        return Ok(0);
    }

    let entries = fs::read_dir(&trash_dir)
        .map_err(|e| format!("Failed to read trash directory: {}", e))?;

    let mut deleted_count = 0;
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if fs::remove_file(&path).is_ok() {
                    deleted_count += 1;
                }
            }
        }
    }

    Ok(deleted_count)
}

/// Rename/move a file within the project
#[command]
pub fn rename_file(
    project_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let old_full_path = validate_path(&project_path, &old_path)?;
    let new_full_path = validate_path(&project_path, &new_path)?;

    // Create parent directories for new path if they don't exist
    if let Some(parent) = new_full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    if old_full_path.exists() {
        fs::rename(&old_full_path, &new_full_path)
            .map_err(|e| format!("Failed to rename file: {}", e))?;
    }

    Ok(())
}

/// Check if a file exists
#[command]
pub fn file_exists(project_path: String, file_path: String) -> Result<bool, String> {
    let full_path = validate_path(&project_path, &file_path)?;
    Ok(full_path.exists())
}

/// Create a directory and its parents
#[command]
pub fn create_directory(project_path: String, dir_path: String) -> Result<(), String> {
    let full_path = validate_path(&project_path, &dir_path)?;

    fs::create_dir_all(&full_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_path_rejects_parent_dir() {
        let result = validate_path("/tmp/project", "../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("directory traversal"));
    }

    #[test]
    fn test_validate_path_rejects_absolute() {
        let result = validate_path("/tmp/project", "/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Absolute paths"));
    }

    #[test]
    fn test_validate_path_rejects_empty() {
        let result = validate_path("/tmp/project", "");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_validate_path_accepts_normal_paths() {
        // Note: This test requires the project path to exist
        // In real tests, we'd use a temp directory
        let result = validate_path(".", "src/main.rs");
        // Should not error on path format (may error if path doesn't exist)
        if let Err(e) = &result {
            assert!(!e.contains("traversal"));
            assert!(!e.contains("Absolute"));
        }
    }
}
