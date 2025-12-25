use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Request for code generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

/// Response from code generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: Option<u32>,
}

/// Error type for LLM operations
#[derive(Debug, thiserror::Error)]
pub enum LLMError {
    #[error("API request failed: {0}")]
    RequestFailed(String),

    #[error("Invalid API key")]
    InvalidApiKey,

    #[error("Rate limited")]
    RateLimited,

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Parse error: {0}")]
    ParseError(String),
}

/// Trait for LLM providers
#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Generate code based on the request
    async fn generate(&self, request: GenerationRequest) -> Result<GenerationResponse, LLMError>;

    /// Get the provider name
    fn name(&self) -> &'static str;

    /// Check if the provider is configured (has API key, etc.)
    fn is_configured(&self) -> bool;
}
