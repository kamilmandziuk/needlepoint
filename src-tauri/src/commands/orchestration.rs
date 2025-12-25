use serde::Deserialize;
use tauri::{command, AppHandle};

use crate::graph::model::Project;
use crate::orchestration::{executor::ApiKeys, ExecutionPlan, Executor};

/// API keys passed from the frontend
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeysInput {
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub ollama_base_url: Option<String>,
}

impl From<ApiKeysInput> for ApiKeys {
    fn from(input: ApiKeysInput) -> Self {
        ApiKeys {
            anthropic: input.anthropic.filter(|s| !s.is_empty()),
            openai: input.openai.filter(|s| !s.is_empty()),
            ollama_base_url: input.ollama_base_url.filter(|s| !s.is_empty()),
        }
    }
}

/// Get the execution plan for a project (for preview)
#[command]
pub fn get_execution_plan(project: Project) -> ExecutionPlan {
    ExecutionPlan::from_project(&project)
}

/// Generate all nodes in the project
/// Returns the updated project with generated code
#[command]
pub async fn generate_all(
    app_handle: AppHandle,
    project: Project,
    api_keys: ApiKeysInput,
) -> Result<Project, String> {
    let executor = Executor::new(app_handle, project, api_keys.into());
    Ok(executor.execute_all().await)
}

/// Generate specific nodes in the project
/// Respects dependency order - will generate dependencies first
#[command]
pub async fn generate_nodes(
    app_handle: AppHandle,
    project: Project,
    node_ids: Vec<String>,
    api_keys: ApiKeysInput,
) -> Result<Project, String> {
    let executor = Executor::new(app_handle, project, api_keys.into());
    Ok(executor.execute_nodes(node_ids).await)
}
