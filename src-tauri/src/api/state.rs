use std::sync::Arc;
use tokio::sync::RwLock;

use crate::graph::model::Project;

/// Shared application state between Tauri and HTTP API
#[derive(Debug, Default)]
pub struct AppState {
    /// Current loaded project (if any)
    pub project: RwLock<Option<Project>>,
    /// API keys for LLM providers
    pub api_keys: RwLock<ApiKeys>,
    /// Port the HTTP server is running on
    pub port: RwLock<Option<u16>>,
}

/// API keys for LLM providers
#[derive(Debug, Clone, Default)]
pub struct ApiKeys {
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub ollama_base_url: Option<String>,
}

impl AppState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Get the current project
    pub async fn get_project(&self) -> Option<Project> {
        self.project.read().await.clone()
    }

    /// Set the current project
    pub async fn set_project(&self, project: Option<Project>) {
        *self.project.write().await = project;
    }

    /// Update the project (applies a mutation function)
    pub async fn update_project<F>(&self, f: F) -> Option<Project>
    where
        F: FnOnce(&mut Project),
    {
        let mut guard = self.project.write().await;
        if let Some(ref mut project) = *guard {
            f(project);
            Some(project.clone())
        } else {
            None
        }
    }

    /// Get API keys
    pub async fn get_api_keys(&self) -> ApiKeys {
        self.api_keys.read().await.clone()
    }

    /// Set API keys
    pub async fn set_api_keys(&self, keys: ApiKeys) {
        *self.api_keys.write().await = keys;
    }
}
