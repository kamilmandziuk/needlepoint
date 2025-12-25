use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Status of a code node in the generation pipeline
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum NodeStatus {
    #[default]
    Pending,
    Generating,
    Complete,
    Error,
    Warning,
}

/// Supported LLM providers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum LLMProvider {
    #[default]
    Anthropic,
    OpenAI,
    Ollama,
}


/// Supported programming languages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    TypeScript,
    JavaScript,
    Python,
    Rust,
    Go,
}

impl std::fmt::Display for Language {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Language::TypeScript => write!(f, "typescript"),
            Language::JavaScript => write!(f, "javascript"),
            Language::Python => write!(f, "python"),
            Language::Rust => write!(f, "rust"),
            Language::Go => write!(f, "go"),
        }
    }
}

/// Position on the graph canvas
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Signature of an exported function/class/variable
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExportSignature {
    pub name: String,
    #[serde(rename = "type")]
    pub type_signature: String,
    pub description: String,
}

/// LLM configuration for a node
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMConfig {
    pub provider: LLMProvider,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            provider: LLMProvider::Anthropic,
            model: "claude-sonnet-4-20250514".to_string(),
            system_prompt: None,
            constraints: Vec::new(),
        }
    }
}

/// A node representing a code file in the graph
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeNode {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub language: Language,
    #[serde(default)]
    pub status: NodeStatus,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub purpose: String,
    #[serde(default)]
    pub exports: Vec<ExportSignature>,
    #[serde(default)]
    pub llm_config: LLMConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(default)]
    pub position: Position,
}

impl CodeNode {
    pub fn new(name: String, file_path: String, language: Language) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            file_path,
            language,
            status: NodeStatus::Pending,
            description: String::new(),
            purpose: String::new(),
            exports: Vec::new(),
            llm_config: LLMConfig::default(),
            generated_code: None,
            error_message: None,
            position: Position::default(),
        }
    }
}

/// An edge representing a relationship between code nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    /// Human-readable label describing the relationship (e.g., "imports types from", "extends class in")
    #[serde(default)]
    pub label: String,
}

impl CodeEdge {
    pub fn new(source: String, target: String, label: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            source,
            target,
            label,
        }
    }
}

/// Default LLM configuration for a project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultLLM {
    pub provider: LLMProvider,
    pub model: String,
    pub api_key_env: String,
}

impl Default for DefaultLLM {
    fn default() -> Self {
        Self {
            provider: LLMProvider::Anthropic,
            model: "claude-sonnet-4-20250514".to_string(),
            api_key_env: "ANTHROPIC_API_KEY".to_string(),
        }
    }
}

/// Project manifest containing metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_point: Option<String>,
    #[serde(default)]
    pub default_llm: DefaultLLM,
}

impl Default for ProjectManifest {
    fn default() -> Self {
        Self {
            name: "New Project".to_string(),
            version: "0.1.0".to_string(),
            entry_point: None,
            default_llm: DefaultLLM::default(),
        }
    }
}

/// The complete project structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub manifest: ProjectManifest,
    #[serde(default)]
    pub nodes: Vec<CodeNode>,
    #[serde(default)]
    pub edges: Vec<CodeEdge>,
    pub project_path: String,
}

impl Project {
    pub fn new(project_path: String) -> Self {
        Self {
            manifest: ProjectManifest::default(),
            nodes: Vec::new(),
            edges: Vec::new(),
            project_path,
        }
    }

    /// Find a node by ID
    pub fn find_node(&self, id: &str) -> Option<&CodeNode> {
        self.nodes.iter().find(|n| n.id == id)
    }

    /// Find a node by ID (mutable)
    pub fn find_node_mut(&mut self, id: &str) -> Option<&mut CodeNode> {
        self.nodes.iter_mut().find(|n| n.id == id)
    }

    /// Get all edges where the given node is the target (dependencies)
    pub fn get_dependencies(&self, node_id: &str) -> Vec<&CodeEdge> {
        self.edges.iter().filter(|e| e.target == node_id).collect()
    }

    /// Get all edges where the given node is the source (dependents)
    pub fn get_dependents(&self, node_id: &str) -> Vec<&CodeEdge> {
        self.edges.iter().filter(|e| e.source == node_id).collect()
    }
}
