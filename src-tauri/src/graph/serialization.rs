use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

use super::model::Project;

const PROJECT_FILE_NAME: &str = "needlepoint.yaml";

/// Load a project from a YAML file
pub fn load_project_from_file(path: &Path) -> Result<Project> {
    let contents = fs::read_to_string(path)
        .with_context(|| format!("Failed to read project file: {:?}", path))?;

    let mut project: Project = serde_yaml::from_str(&contents)
        .with_context(|| format!("Failed to parse project file: {:?}", path))?;

    // Ensure project_path is set correctly
    if let Some(parent) = path.parent() {
        project.project_path = parent.to_string_lossy().to_string();
    }

    Ok(project)
}

/// Save a project to a YAML file
pub fn save_project_to_file(project: &Project) -> Result<()> {
    let project_file = Path::new(&project.project_path).join(PROJECT_FILE_NAME);

    let contents = serde_yaml::to_string(project)
        .context("Failed to serialize project")?;

    fs::write(&project_file, contents)
        .with_context(|| format!("Failed to write project file: {:?}", project_file))?;

    Ok(())
}

/// Create a new project in the given directory
pub fn create_new_project(directory: &Path) -> Result<Project> {
    let project = Project::new(directory.to_string_lossy().to_string());
    save_project_to_file(&project)?;
    Ok(project)
}

/// Check if a directory contains a needlepoint project
pub fn is_project_directory(path: &Path) -> bool {
    path.join(PROJECT_FILE_NAME).exists()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_and_load_project() {
        let dir = tempdir().unwrap();

        // Create a new project
        let project = create_new_project(dir.path()).unwrap();
        assert_eq!(project.manifest.name, "New Project");
        assert!(project.nodes.is_empty());

        // Load it back
        let loaded = load_project_from_file(&dir.path().join(PROJECT_FILE_NAME)).unwrap();
        assert_eq!(loaded.manifest.name, project.manifest.name);
    }
}
