use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter};

use crate::graph::model::{NodeStatus, Project};
use crate::llm::{create_provider, strip_code_blocks, ContextBuilder, GenerationRequest};

use super::events::{ExecutionEvent, NodeProgress, EXECUTION_EVENT_CHANNEL};
use super::planner::ExecutionPlan;

/// API keys for different providers
#[derive(Debug, Clone, Default)]
pub struct ApiKeys {
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub ollama_base_url: Option<String>,
}

impl ApiKeys {
    /// Get the API key for a specific provider
    pub fn get_for_provider(&self, provider: &crate::graph::model::LLMProvider) -> Option<String> {
        match provider {
            crate::graph::model::LLMProvider::Anthropic => self.anthropic.clone(),
            crate::graph::model::LLMProvider::OpenAI => self.openai.clone(),
            crate::graph::model::LLMProvider::Ollama => None, // Ollama doesn't need API key
        }
    }
}

/// Result of generating a single node
#[derive(Debug, Clone)]
pub struct NodeResult {
    pub node_id: String,
    pub success: bool,
    pub generated_code: Option<String>,
    pub error_message: Option<String>,
}

/// Executor for running code generation across the graph
pub struct Executor {
    app_handle: AppHandle,
    project: Arc<RwLock<Project>>,
    api_keys: ApiKeys,
    cancelled: Arc<RwLock<bool>>,
}

impl Executor {
    pub fn new(app_handle: AppHandle, project: Project, api_keys: ApiKeys) -> Self {
        Self {
            app_handle,
            project: Arc::new(RwLock::new(project)),
            api_keys,
            cancelled: Arc::new(RwLock::new(false)),
        }
    }

    /// Emit an event to the frontend
    fn emit(&self, event: ExecutionEvent) {
        let _ = self.app_handle.emit(EXECUTION_EVENT_CHANNEL, &event);
    }

    /// Check if execution has been cancelled
    async fn is_cancelled(&self) -> bool {
        *self.cancelled.read().await
    }

    /// Generate code for a single node
    async fn generate_node(&self, node_id: &str) -> NodeResult {
        // Get current project state
        let project = self.project.read().await;

        let node = match project.find_node(node_id) {
            Some(n) => n.clone(),
            None => {
                return NodeResult {
                    node_id: node_id.to_string(),
                    success: false,
                    generated_code: None,
                    error_message: Some(format!("Node '{}' not found", node_id)),
                };
            }
        };

        // Build prompt
        let prompt = match ContextBuilder::build_prompt(&project, node_id) {
            Some(p) => p,
            None => {
                return NodeResult {
                    node_id: node_id.to_string(),
                    success: false,
                    generated_code: None,
                    error_message: Some("Failed to build prompt".to_string()),
                };
            }
        };

        let system_prompt = ContextBuilder::build_system_prompt(&node);

        // Get API key for provider
        let api_key = self.api_keys.get_for_provider(&node.llm_config.provider);

        // Create provider
        let provider = create_provider(&node.llm_config, api_key);

        if !provider.is_configured() {
            return NodeResult {
                node_id: node_id.to_string(),
                success: false,
                generated_code: None,
                error_message: Some(format!(
                    "{} is not configured. Please set your API key in Settings.",
                    provider.name()
                )),
            };
        }

        // Release the read lock before making async call
        drop(project);

        // Generate
        let request = GenerationRequest {
            prompt,
            system_prompt: Some(system_prompt),
            max_tokens: Some(4096),
            temperature: Some(0.7),
        };

        match provider.generate(request).await {
            Ok(response) => NodeResult {
                node_id: node_id.to_string(),
                success: true,
                // Strip markdown code blocks if present
                generated_code: Some(strip_code_blocks(&response.content)),
                error_message: None,
            },
            Err(e) => NodeResult {
                node_id: node_id.to_string(),
                success: false,
                generated_code: None,
                error_message: Some(e.to_string()),
            },
        }
    }

    /// Update a node's status and optionally its generated code
    async fn update_node(&self, node_id: &str, status: NodeStatus, code: Option<String>, error: Option<String>) {
        let mut project = self.project.write().await;
        if let Some(node) = project.find_node_mut(node_id) {
            node.status = status;
            if let Some(c) = code {
                node.generated_code = Some(c);
            }
            if let Some(e) = error {
                node.error_message = Some(e);
            } else {
                node.error_message = None;
            }
        }
    }

    /// Execute generation for all nodes in the project
    pub async fn execute_all(&self) -> Project {
        let project = self.project.read().await;
        let plan = ExecutionPlan::from_project(&project);
        drop(project);

        // Emit start event
        self.emit(ExecutionEvent::Started {
            total_nodes: plan.total_nodes,
            total_waves: plan.waves.len(),
        });

        let mut total_successful = 0;
        let mut total_failed = 0;

        // Process each wave
        for wave in &plan.waves {
            if self.is_cancelled().await {
                self.emit(ExecutionEvent::Cancelled);
                break;
            }

            // Emit wave started
            self.emit(ExecutionEvent::WaveStarted {
                wave_number: wave.wave_number,
                node_ids: wave.node_ids.clone(),
            });

            // Mark all nodes in wave as generating
            for node_id in &wave.node_ids {
                self.update_node(node_id, NodeStatus::Generating, None, None).await;
                self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                    node_id: node_id.clone(),
                    status: NodeStatus::Generating,
                    message: Some("Starting generation...".to_string()),
                    generated_code: None,
                }));
            }

            // Generate all nodes in this wave concurrently
            let futures: Vec<_> = wave
                .node_ids
                .iter()
                .map(|node_id| {
                    let node_id = node_id.clone();
                    let self_ref = self;
                    async move { self_ref.generate_node(&node_id).await }
                })
                .collect();

            let results = futures::future::join_all(futures).await;

            // Process results
            let mut wave_successful = 0;
            let mut wave_failed = 0;

            for result in results {
                if result.success {
                    wave_successful += 1;
                    self.update_node(
                        &result.node_id,
                        NodeStatus::Complete,
                        result.generated_code.clone(),
                        None,
                    )
                    .await;
                    self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                        node_id: result.node_id.clone(),
                        status: NodeStatus::Complete,
                        message: Some("Generation complete".to_string()),
                        generated_code: result.generated_code,
                    }));
                } else {
                    wave_failed += 1;
                    self.update_node(
                        &result.node_id,
                        NodeStatus::Error,
                        None,
                        result.error_message.clone(),
                    )
                    .await;
                    self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                        node_id: result.node_id.clone(),
                        status: NodeStatus::Error,
                        message: result.error_message,
                        generated_code: None,
                    }));
                }
            }

            total_successful += wave_successful;
            total_failed += wave_failed;

            // Emit wave completed
            self.emit(ExecutionEvent::WaveCompleted {
                wave_number: wave.wave_number,
                successful: wave_successful,
                failed: wave_failed,
            });
        }

        // Emit completed
        self.emit(ExecutionEvent::Completed {
            total_successful,
            total_failed,
            total_skipped: plan.skipped_nodes.len(),
        });

        // Return updated project
        self.project.read().await.clone()
    }

    /// Execute generation for specific nodes only
    pub async fn execute_nodes(&self, node_ids: Vec<String>) -> Project {
        let project = self.project.read().await;
        let full_plan = ExecutionPlan::from_project(&project);
        drop(project);

        // Filter waves to only include requested nodes
        let node_set: std::collections::HashSet<String> = node_ids.into_iter().collect();

        let filtered_waves: Vec<_> = full_plan
            .waves
            .iter()
            .map(|w| super::planner::ExecutionWave {
                wave_number: w.wave_number,
                node_ids: w
                    .node_ids
                    .iter()
                    .filter(|id| node_set.contains(*id))
                    .cloned()
                    .collect(),
            })
            .filter(|w| !w.node_ids.is_empty())
            .collect();

        let total_nodes: usize = filtered_waves.iter().map(|w| w.node_ids.len()).sum();

        // Emit start event
        self.emit(ExecutionEvent::Started {
            total_nodes,
            total_waves: filtered_waves.len(),
        });

        let mut total_successful = 0;
        let mut total_failed = 0;

        // Process each wave
        for wave in &filtered_waves {
            if self.is_cancelled().await {
                self.emit(ExecutionEvent::Cancelled);
                break;
            }

            // Emit wave started
            self.emit(ExecutionEvent::WaveStarted {
                wave_number: wave.wave_number,
                node_ids: wave.node_ids.clone(),
            });

            // Mark all nodes in wave as generating
            for node_id in &wave.node_ids {
                self.update_node(node_id, NodeStatus::Generating, None, None).await;
                self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                    node_id: node_id.clone(),
                    status: NodeStatus::Generating,
                    message: Some("Starting generation...".to_string()),
                    generated_code: None,
                }));
            }

            // Generate all nodes in this wave concurrently
            let futures: Vec<_> = wave
                .node_ids
                .iter()
                .map(|node_id| {
                    let node_id = node_id.clone();
                    let self_ref = self;
                    async move { self_ref.generate_node(&node_id).await }
                })
                .collect();

            let results = futures::future::join_all(futures).await;

            // Process results
            let mut wave_successful = 0;
            let mut wave_failed = 0;

            for result in results {
                if result.success {
                    wave_successful += 1;
                    self.update_node(
                        &result.node_id,
                        NodeStatus::Complete,
                        result.generated_code.clone(),
                        None,
                    )
                    .await;
                    self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                        node_id: result.node_id.clone(),
                        status: NodeStatus::Complete,
                        message: Some("Generation complete".to_string()),
                        generated_code: result.generated_code,
                    }));
                } else {
                    wave_failed += 1;
                    self.update_node(
                        &result.node_id,
                        NodeStatus::Error,
                        None,
                        result.error_message.clone(),
                    )
                    .await;
                    self.emit(ExecutionEvent::NodeUpdate(NodeProgress {
                        node_id: result.node_id.clone(),
                        status: NodeStatus::Error,
                        message: result.error_message,
                        generated_code: None,
                    }));
                }
            }

            total_successful += wave_successful;
            total_failed += wave_failed;

            // Emit wave completed
            self.emit(ExecutionEvent::WaveCompleted {
                wave_number: wave.wave_number,
                successful: wave_successful,
                failed: wave_failed,
            });
        }

        // Emit completed
        self.emit(ExecutionEvent::Completed {
            total_successful,
            total_failed,
            total_skipped: 0,
        });

        // Return updated project
        self.project.read().await.clone()
    }

    /// Cancel the current execution
    pub async fn cancel(&self) {
        let mut cancelled = self.cancelled.write().await;
        *cancelled = true;
    }
}
