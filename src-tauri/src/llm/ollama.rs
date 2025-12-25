use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{GenerationRequest, GenerationResponse, LLMError, LLMProvider};

const OLLAMA_API_URL: &str = "http://localhost:11434/api/generate";

#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
    model: String,
    #[serde(default)]
    eval_count: u32,
    #[serde(default)]
    prompt_eval_count: u32,
}

pub struct OllamaProvider {
    model: String,
    client: Client,
}

impl OllamaProvider {
    pub fn new(model: String) -> Self {
        Self {
            model,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LLMProvider for OllamaProvider {
    async fn generate(&self, request: GenerationRequest) -> Result<GenerationResponse, LLMError> {
        let ollama_request = OllamaRequest {
            model: self.model.clone(),
            prompt: request.prompt,
            system: request.system_prompt,
            stream: false,
            options: OllamaOptions {
                temperature: request.temperature,
                num_predict: request.max_tokens,
            },
        };

        let response = self
            .client
            .post(OLLAMA_API_URL)
            .json(&ollama_request)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    LLMError::NetworkError(
                        "Cannot connect to Ollama. Make sure Ollama is running.".to_string(),
                    )
                } else {
                    LLMError::NetworkError(e.to_string())
                }
            })?;

        let status = response.status();

        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(LLMError::ModelNotFound(self.model.clone()));
        }

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(LLMError::RequestFailed(format!(
                "HTTP {}: {}",
                status, error_text
            )));
        }

        let ollama_response: OllamaResponse = response
            .json()
            .await
            .map_err(|e| LLMError::ParseError(e.to_string()))?;

        Ok(GenerationResponse {
            content: ollama_response.response,
            model: ollama_response.model,
            tokens_used: Some(ollama_response.eval_count + ollama_response.prompt_eval_count),
        })
    }

    fn name(&self) -> &'static str {
        "Ollama"
    }

    fn is_configured(&self) -> bool {
        true // Ollama doesn't need API key
    }
}
