use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{GenerationRequest, GenerationResponse, LLMError, LLMProvider};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    model: String,
    usage: AnthropicUsage,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct AnthropicError {
    error: AnthropicErrorDetail,
}

#[derive(Debug, Deserialize)]
struct AnthropicErrorDetail {
    message: String,
}

pub struct AnthropicProvider {
    api_key: Option<String>,
    model: String,
    client: Client,
}

impl AnthropicProvider {
    pub fn new(api_key: Option<String>, model: String) -> Self {
        Self {
            api_key,
            model,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LLMProvider for AnthropicProvider {
    async fn generate(&self, request: GenerationRequest) -> Result<GenerationResponse, LLMError> {
        let api_key = self.api_key.as_ref().ok_or(LLMError::InvalidApiKey)?;

        let anthropic_request = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: request.max_tokens.unwrap_or(4096),
            messages: vec![AnthropicMessage {
                role: "user".to_string(),
                content: request.prompt,
            }],
            system: request.system_prompt,
            temperature: request.temperature,
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| LLMError::NetworkError(e.to_string()))?;

        let status = response.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(LLMError::InvalidApiKey);
        }

        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LLMError::RateLimited);
        }

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if let Ok(error) = serde_json::from_str::<AnthropicError>(&error_text) {
                return Err(LLMError::RequestFailed(error.error.message));
            }
            return Err(LLMError::RequestFailed(format!(
                "HTTP {}: {}",
                status, error_text
            )));
        }

        let anthropic_response: AnthropicResponse = response
            .json()
            .await
            .map_err(|e| LLMError::ParseError(e.to_string()))?;

        let content = anthropic_response
            .content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default();

        Ok(GenerationResponse {
            content,
            model: anthropic_response.model,
            tokens_used: Some(
                anthropic_response.usage.input_tokens + anthropic_response.usage.output_tokens,
            ),
        })
    }

    fn name(&self) -> &'static str {
        "Anthropic"
    }

    fn is_configured(&self) -> bool {
        self.api_key.is_some()
    }
}
