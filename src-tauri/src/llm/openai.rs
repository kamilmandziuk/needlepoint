use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{GenerationRequest, GenerationResponse, LLMError, LLMProvider};

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Serialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    model: String,
    usage: OpenAIUsage,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessageResponse,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessageResponse {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIError {
    error: OpenAIErrorDetail,
}

#[derive(Debug, Deserialize)]
struct OpenAIErrorDetail {
    message: String,
}

pub struct OpenAIProvider {
    api_key: Option<String>,
    model: String,
    client: Client,
}

impl OpenAIProvider {
    pub fn new(api_key: Option<String>, model: String) -> Self {
        Self {
            api_key,
            model,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl LLMProvider for OpenAIProvider {
    async fn generate(&self, request: GenerationRequest) -> Result<GenerationResponse, LLMError> {
        let api_key = self.api_key.as_ref().ok_or(LLMError::InvalidApiKey)?;

        let mut messages = Vec::new();

        if let Some(system) = request.system_prompt {
            messages.push(OpenAIMessage {
                role: "system".to_string(),
                content: system,
            });
        }

        messages.push(OpenAIMessage {
            role: "user".to_string(),
            content: request.prompt,
        });

        let openai_request = OpenAIRequest {
            model: self.model.clone(),
            messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&openai_request)
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
            if let Ok(error) = serde_json::from_str::<OpenAIError>(&error_text) {
                return Err(LLMError::RequestFailed(error.error.message));
            }
            return Err(LLMError::RequestFailed(format!(
                "HTTP {}: {}",
                status, error_text
            )));
        }

        let openai_response: OpenAIResponse = response
            .json()
            .await
            .map_err(|e| LLMError::ParseError(e.to_string()))?;

        let content = openai_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        Ok(GenerationResponse {
            content,
            model: openai_response.model,
            tokens_used: Some(openai_response.usage.total_tokens),
        })
    }

    fn name(&self) -> &'static str {
        "OpenAI"
    }

    fn is_configured(&self) -> bool {
        self.api_key.is_some()
    }
}
