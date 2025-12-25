use std::env;
use tauri::command;

use crate::graph::model::Project;
use crate::llm::{create_provider, strip_code_blocks, ContextBuilder, GenerationRequest};

/// Generate code for a specific node
/// api_key: Optional API key passed from the frontend settings
#[command]
pub async fn generate_node(
    project: Project,
    node_id: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let node = project
        .find_node(&node_id)
        .ok_or_else(|| format!("Node '{}' not found", node_id))?;

    // Build the prompt from context
    let prompt = ContextBuilder::build_prompt(&project, &node_id)
        .ok_or_else(|| "Failed to build prompt".to_string())?;

    let system_prompt = ContextBuilder::build_system_prompt(node);

    // Use provided API key, or fall back to environment variable
    let effective_api_key = api_key.filter(|k| !k.is_empty()).or_else(|| {
        match node.llm_config.provider {
            crate::graph::model::LLMProvider::Anthropic => env::var("ANTHROPIC_API_KEY").ok(),
            crate::graph::model::LLMProvider::OpenAI => env::var("OPENAI_API_KEY").ok(),
            crate::graph::model::LLMProvider::Ollama => None, // No API key needed
        }
    });

    // Create provider and generate
    let provider = create_provider(&node.llm_config, effective_api_key);

    if !provider.is_configured() {
        return Err(format!(
            "{} is not configured. Please set your API key in Settings or as an environment variable.",
            provider.name()
        ));
    }

    let request = GenerationRequest {
        prompt,
        system_prompt: Some(system_prompt),
        max_tokens: Some(4096),
        temperature: Some(0.7),
    };

    let response = provider
        .generate(request)
        .await
        .map_err(|e| e.to_string())?;

    // Strip markdown code blocks if present
    Ok(strip_code_blocks(&response.content))
}

/// Get the prompt that would be used for generation (for preview)
#[command]
pub fn preview_prompt(project: Project, node_id: String) -> Result<String, String> {
    ContextBuilder::build_prompt(&project, &node_id)
        .ok_or_else(|| format!("Node '{}' not found", node_id))
}
