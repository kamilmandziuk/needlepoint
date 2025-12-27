use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::graph::model::{CodeEdge, CodeNode, Language, Project, ProjectManifest};
use crate::graph::{load_project_from_file, save_project_to_file};
use crate::llm::{create_provider, strip_code_blocks, ContextBuilder, GenerationRequest};
use crate::orchestration::ExecutionPlan;

use super::state::{ApiKeys, AppState};

/// Create all API routes
pub fn create_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Status
        .route("/status", get(get_status))
        // Project
        .route("/project", get(get_project))
        .route("/project/new", post(new_project))
        .route("/project/load", post(load_project))
        .route("/project/save", post(save_project))
        // Nodes
        .route("/nodes", get(list_nodes))
        .route("/nodes", post(create_node))
        .route("/nodes/:id", get(get_node))
        .route("/nodes/:id", put(update_node))
        .route("/nodes/:id", delete(delete_node))
        // Edges
        .route("/edges", get(list_edges))
        .route("/edges", post(create_edge))
        .route("/edges/:id", delete(delete_edge))
        // Generation
        .route("/generate/:id", post(generate_node))
        .route("/generate-all", post(generate_all))
        .route("/execution-plan", get(get_execution_plan))
        .route("/prompt/:id", get(preview_prompt))
        // API Keys
        .route("/api-keys", post(set_api_keys))
}

// === Response Types ===

#[derive(Serialize)]
struct StatusResponse {
    status: String,
    version: String,
    project_loaded: bool,
    project_name: Option<String>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Deserialize)]
struct NewProjectRequest {
    path: String,
    #[serde(default = "default_project_name")]
    name: String,
}

fn default_project_name() -> String {
    "New Project".to_string()
}

#[derive(Deserialize)]
struct LoadProjectRequest {
    path: String,
}

#[derive(Deserialize)]
struct CreateNodeRequest {
    name: String,
    file_path: String,
    #[serde(default)]
    language: Option<Language>,
}

#[derive(Deserialize)]
struct UpdateNodeRequest {
    #[serde(flatten)]
    updates: serde_json::Value,
}

#[derive(Deserialize)]
struct CreateEdgeRequest {
    source: String,
    target: String,
    #[serde(default)]
    label: String,
}

#[derive(Deserialize)]
struct GenerateRequest {
    #[serde(default)]
    api_key: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiKeysRequest {
    anthropic: Option<String>,
    openai: Option<String>,
    ollama_base_url: Option<String>,
}

#[derive(Serialize)]
struct GenerateResponse {
    code: String,
    node_id: String,
}

// === Handlers ===

async fn get_status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let project = state.get_project().await;
    Json(StatusResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        project_loaded: project.is_some(),
        project_name: project.map(|p| p.manifest.name),
    })
}

async fn get_project(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Project>, (StatusCode, Json<ErrorResponse>)> {
    state
        .get_project()
        .await
        .map(Json)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "No project loaded".to_string(),
                }),
            )
        })
}

async fn new_project(
    State(state): State<Arc<AppState>>,
    Json(req): Json<NewProjectRequest>,
) -> Result<Json<Project>, (StatusCode, Json<ErrorResponse>)> {
    let path = std::path::Path::new(&req.path);

    // Create the directory if it doesn't exist
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Failed to create directory: {}", e),
                }),
            )
        })?;
    }

    // Create a new project
    let mut manifest = ProjectManifest::default();
    manifest.name = req.name;

    let project = Project {
        manifest,
        nodes: Vec::new(),
        edges: Vec::new(),
        project_path: path.to_string_lossy().to_string(),
    };

    // Save the project to disk
    save_project_to_file(&project).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to save project: {}", e),
            }),
        )
    })?;

    state.set_project(Some(project.clone())).await;
    Ok(Json(project))
}

async fn load_project(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoadProjectRequest>,
) -> Result<Json<Project>, (StatusCode, Json<ErrorResponse>)> {
    let path = std::path::Path::new(&req.path);
    let project = load_project_from_file(path).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    state.set_project(Some(project.clone())).await;
    Ok(Json(project))
}

async fn save_project(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    save_project_to_file(&project).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    Ok(Json(serde_json::json!({ "saved": true })))
}

async fn list_nodes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CodeNode>>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    Ok(Json(project.nodes))
}

async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CodeNode>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    project
        .find_node(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Node '{}' not found", id),
                }),
            )
        })
}

async fn create_node(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateNodeRequest>,
) -> Result<Json<CodeNode>, (StatusCode, Json<ErrorResponse>)> {
    let language = req.language.unwrap_or_default();
    let node = CodeNode::new(req.name, req.file_path, language);
    let node_clone = node.clone();

    state
        .update_project(|p| {
            p.nodes.push(node);
        })
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "No project loaded".to_string(),
                }),
            )
        })?;

    Ok(Json(node_clone))
}

async fn update_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateNodeRequest>,
) -> Result<Json<CodeNode>, (StatusCode, Json<ErrorResponse>)> {
    let mut updated_node = None;

    state
        .update_project(|p| {
            if let Some(node) = p.find_node_mut(&id) {
                // Apply updates from the JSON
                if let Some(name) = req.updates.get("name").and_then(|v| v.as_str()) {
                    node.name = name.to_string();
                }
                if let Some(file_path) = req.updates.get("filePath").and_then(|v| v.as_str()) {
                    node.file_path = file_path.to_string();
                }
                if let Some(description) = req.updates.get("description").and_then(|v| v.as_str()) {
                    node.description = description.to_string();
                }
                if let Some(purpose) = req.updates.get("purpose").and_then(|v| v.as_str()) {
                    node.purpose = purpose.to_string();
                }
                if let Some(code) = req.updates.get("generatedCode").and_then(|v| v.as_str()) {
                    node.generated_code = Some(code.to_string());
                }
                updated_node = Some(node.clone());
            }
        })
        .await;

    updated_node.map(Json).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Node '{}' not found", id),
            }),
        )
    })
}

async fn delete_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let mut found = false;

    state
        .update_project(|p| {
            let before = p.nodes.len();
            p.nodes.retain(|n| n.id != id);
            // Also remove edges connected to this node
            p.edges.retain(|e| e.source != id && e.target != id);
            found = p.nodes.len() < before;
        })
        .await;

    if found {
        Ok(Json(serde_json::json!({ "deleted": true })))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Node '{}' not found", id),
            }),
        ))
    }
}

async fn list_edges(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CodeEdge>>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    Ok(Json(project.edges))
}

async fn create_edge(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateEdgeRequest>,
) -> Result<Json<CodeEdge>, (StatusCode, Json<ErrorResponse>)> {
    let edge = CodeEdge::new(req.source, req.target, req.label);
    let edge_clone = edge.clone();

    state
        .update_project(|p| {
            p.edges.push(edge);
        })
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "No project loaded".to_string(),
                }),
            )
        })?;

    Ok(Json(edge_clone))
}

async fn delete_edge(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let mut found = false;

    state
        .update_project(|p| {
            let before = p.edges.len();
            p.edges.retain(|e| e.id != id);
            found = p.edges.len() < before;
        })
        .await;

    if found {
        Ok(Json(serde_json::json!({ "deleted": true })))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Edge '{}' not found", id),
            }),
        ))
    }
}

async fn generate_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    let node = project.find_node(&id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Node '{}' not found", id),
            }),
        )
    })?;

    // Build prompt
    let prompt = ContextBuilder::build_prompt(&project, &id).ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to build prompt".to_string(),
            }),
        )
    })?;

    let system_prompt = ContextBuilder::build_system_prompt(node);

    // Get API key
    let api_keys = state.get_api_keys().await;
    let api_key = req.api_key.or_else(|| match node.llm_config.provider {
        crate::graph::model::LLMProvider::Anthropic => api_keys.anthropic.clone(),
        crate::graph::model::LLMProvider::OpenAI => api_keys.openai.clone(),
        crate::graph::model::LLMProvider::Ollama => None,
    });

    // Create provider and generate
    let provider = create_provider(&node.llm_config, api_key);

    if !provider.is_configured() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "{} is not configured. Set API key via POST /api/api-keys or in request body.",
                    provider.name()
                ),
            }),
        ));
    }

    let request = GenerationRequest {
        prompt,
        system_prompt: Some(system_prompt),
        max_tokens: Some(4096),
        temperature: Some(0.7),
    };

    let response = provider.generate(request).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    let code = strip_code_blocks(&response.content);

    // Update node with generated code
    state
        .update_project(|p| {
            if let Some(node) = p.find_node_mut(&id) {
                node.generated_code = Some(code.clone());
                node.status = crate::graph::model::NodeStatus::Complete;
            }
        })
        .await;

    Ok(Json(GenerateResponse {
        code,
        node_id: id,
    }))
}

async fn generate_all(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Project>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    let api_keys = state.get_api_keys().await;

    // Create executor without AppHandle (no Tauri events in HTTP API)
    // We'll need to run generation manually for each node in order
    let plan = ExecutionPlan::from_project(&project);
    let mut result_project = project;

    for wave in &plan.waves {
        for node_id in &wave.node_ids {
            if let Some(node) = result_project.find_node(node_id) {
                let prompt = match ContextBuilder::build_prompt(&result_project, node_id) {
                    Some(p) => p,
                    None => continue,
                };

                let system_prompt = ContextBuilder::build_system_prompt(node);

                let api_key = match node.llm_config.provider {
                    crate::graph::model::LLMProvider::Anthropic => api_keys.anthropic.clone(),
                    crate::graph::model::LLMProvider::OpenAI => api_keys.openai.clone(),
                    crate::graph::model::LLMProvider::Ollama => None,
                };

                let provider = create_provider(&node.llm_config, api_key);

                if provider.is_configured() {
                    let request = GenerationRequest {
                        prompt,
                        system_prompt: Some(system_prompt),
                        max_tokens: Some(4096),
                        temperature: Some(0.7),
                    };

                    match provider.generate(request).await {
                        Ok(response) => {
                            let code = strip_code_blocks(&response.content);
                            if let Some(node) = result_project.find_node_mut(node_id) {
                                node.generated_code = Some(code);
                                node.status = crate::graph::model::NodeStatus::Complete;
                            }
                        }
                        Err(e) => {
                            if let Some(node) = result_project.find_node_mut(node_id) {
                                node.status = crate::graph::model::NodeStatus::Error;
                                node.error_message = Some(e.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    state.set_project(Some(result_project.clone())).await;
    Ok(Json(result_project))
}

async fn get_execution_plan(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ExecutionPlan>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    Ok(Json(ExecutionPlan::from_project(&project)))
}

async fn preview_prompt(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let project = state.get_project().await.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "No project loaded".to_string(),
            }),
        )
    })?;

    let prompt = ContextBuilder::build_prompt(&project, &id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Node '{}' not found", id),
            }),
        )
    })?;

    Ok(Json(serde_json::json!({ "prompt": prompt })))
}

async fn set_api_keys(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiKeysRequest>,
) -> Json<serde_json::Value> {
    state
        .set_api_keys(ApiKeys {
            anthropic: req.anthropic,
            openai: req.openai,
            ollama_base_url: req.ollama_base_url,
        })
        .await;

    Json(serde_json::json!({ "updated": true }))
}
