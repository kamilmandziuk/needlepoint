use std::path::Path;

use tauri::command;

use crate::graph::{
    load_project_from_file, save_project_to_file, Project,
};

/// Load a project from a YAML file
#[command]
pub fn load_project(path: String) -> Result<Project, String> {
    let path = Path::new(&path);

    load_project_from_file(path).map_err(|e| e.to_string())
}

/// Save a project to its YAML file
#[command]
pub fn save_project(project: Project) -> Result<(), String> {
    save_project_to_file(&project).map_err(|e| e.to_string())
}
