pub mod provider;
pub mod anthropic;
pub mod openai;
pub mod ollama;
pub mod context;

pub use provider::{LLMProvider, GenerationRequest, GenerationResponse};
pub use anthropic::AnthropicProvider;
pub use openai::OpenAIProvider;
pub use ollama::OllamaProvider;
pub use context::{ContextBuilder, strip_code_blocks};

use crate::graph::model::LLMConfig;

/// Create an LLM provider based on configuration
pub fn create_provider(config: &LLMConfig, api_key: Option<String>) -> Box<dyn LLMProvider> {
    match config.provider {
        crate::graph::model::LLMProvider::Anthropic => {
            Box::new(AnthropicProvider::new(api_key, config.model.clone()))
        }
        crate::graph::model::LLMProvider::OpenAI => {
            Box::new(OpenAIProvider::new(api_key, config.model.clone()))
        }
        crate::graph::model::LLMProvider::Ollama => {
            Box::new(OllamaProvider::new(config.model.clone()))
        }
    }
}
