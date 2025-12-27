use clap::{Parser, Subcommand};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

const DEFAULT_PORT: u16 = 9999;

#[derive(Parser)]
#[command(name = "needlepoint-cli")]
#[command(about = "CLI interface for Needlepoint graph-based code orchestration")]
#[command(version)]
struct Cli {
    /// Port where Needlepoint API is running
    #[arg(short, long, default_value_t = DEFAULT_PORT)]
    port: u16,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check if the Needlepoint API is running
    Status,

    /// Create a new project
    New {
        /// Path to the project directory
        path: PathBuf,

        /// Project name
        #[arg(short, long, default_value = "New Project")]
        name: String,
    },

    /// Load a project from a YAML file
    Load {
        /// Path to the project YAML file
        path: PathBuf,
    },

    /// Save the current project
    Save,

    /// List all nodes in the project
    Nodes,

    /// Get details of a specific node
    Node {
        /// Node ID
        id: String,
    },

    /// Add a new node to the project
    AddNode {
        /// Node name
        name: String,

        /// File path (relative to project)
        #[arg(short, long)]
        path: String,

        /// Programming language
        #[arg(short, long, default_value = "typescript")]
        language: String,

        /// Description of what the file does
        #[arg(short, long, default_value = "")]
        description: String,
    },

    /// Update a node's properties
    UpdateNode {
        /// Node ID
        id: String,

        /// New description
        #[arg(short, long)]
        description: Option<String>,

        /// New purpose
        #[arg(short, long)]
        purpose: Option<String>,

        /// New name
        #[arg(short, long)]
        name: Option<String>,
    },

    /// Delete a node
    DeleteNode {
        /// Node ID
        id: String,
    },

    /// List all edges in the project
    Edges,

    /// Add an edge between two nodes
    AddEdge {
        /// Source node ID
        source: String,

        /// Target node ID
        target: String,

        /// Relationship label
        #[arg(short, long, default_value = "depends on")]
        label: String,
    },

    /// Delete an edge
    DeleteEdge {
        /// Edge ID
        id: String,
    },

    /// Get the execution plan (dependency order)
    Plan,

    /// Preview the prompt for a node
    Prompt {
        /// Node ID
        id: String,
    },

    /// Generate code for a specific node
    Generate {
        /// Node ID
        id: String,
    },

    /// Generate code for all nodes in the project
    GenerateAll,

    /// Write generated code to files on disk
    WriteFiles,

    /// Set API keys for LLM providers
    SetKeys {
        /// Anthropic API key (or use ANTHROPIC_API_KEY env var)
        #[arg(long, env = "ANTHROPIC_API_KEY")]
        anthropic: Option<String>,

        /// OpenAI API key (or use OPENAI_API_KEY env var)
        #[arg(long, env = "OPENAI_API_KEY")]
        openai: Option<String>,

        /// Ollama base URL (or use OLLAMA_BASE_URL env var)
        #[arg(long, env = "OLLAMA_BASE_URL")]
        ollama_url: Option<String>,
    },

    /// Get the full project as JSON
    Project,
}

#[derive(Deserialize)]
struct StatusResponse {
    status: String,
    version: String,
    project_loaded: bool,
    project_name: Option<String>,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Node {
    id: String,
    name: String,
    file_path: String,
    status: String,
    description: String,
    generated_code: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Edge {
    id: String,
    source: String,
    target: String,
    label: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ExecutionWave {
    wave_number: u32,
    node_ids: Vec<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ExecutionPlan {
    waves: Vec<ExecutionWave>,
    total_nodes: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiKeysRequest {
    anthropic: Option<String>,
    openai: Option<String>,
    ollama_base_url: Option<String>,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let client = Client::new();
    let base_url = format!("http://127.0.0.1:{}/api", cli.port);

    match run(&client, &base_url, cli.command).await {
        Ok(_) => {}
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}

async fn run(client: &Client, base_url: &str, command: Commands) -> Result<(), String> {
    match command {
        Commands::Status => {
            let resp: StatusResponse = get(client, &format!("{}/status", base_url)).await?;
            println!("Status: {}", resp.status);
            println!("Version: {}", resp.version);
            println!(
                "Project: {}",
                if resp.project_loaded {
                    resp.project_name.unwrap_or_else(|| "unnamed".to_string())
                } else {
                    "none loaded".to_string()
                }
            );
        }

        Commands::New { path, name } => {
            let abs_path = if path.is_absolute() {
                path.to_string_lossy().to_string()
            } else {
                std::env::current_dir()
                    .map_err(|e| format!("Failed to get current dir: {}", e))?
                    .join(&path)
                    .to_string_lossy()
                    .to_string()
            };

            let body = serde_json::json!({ "path": abs_path, "name": name });
            let _: Value = post(client, &format!("{}/project/new", base_url), &body).await?;
            println!("Created new project '{}' at: {}", name, abs_path);
        }

        Commands::Load { path } => {
            let abs_path = std::fs::canonicalize(&path)
                .map_err(|e| format!("Invalid path: {}", e))?
                .to_string_lossy()
                .to_string();

            let body = serde_json::json!({ "path": abs_path });
            let _: Value = post(client, &format!("{}/project/load", base_url), &body).await?;
            println!("Project loaded from: {}", abs_path);
        }

        Commands::Save => {
            let _: Value = post(client, &format!("{}/project/save", base_url), &serde_json::json!({})).await?;
            println!("Project saved");
        }

        Commands::Nodes => {
            let nodes: Vec<Node> = get(client, &format!("{}/nodes", base_url)).await?;
            if nodes.is_empty() {
                println!("No nodes in project");
            } else {
                println!("{:<36} {:<20} {:<12} {}", "ID", "NAME", "STATUS", "PATH");
                println!("{}", "-".repeat(80));
                for node in nodes {
                    println!(
                        "{:<36} {:<20} {:<12} {}",
                        node.id,
                        truncate(&node.name, 18),
                        node.status,
                        node.file_path
                    );
                }
            }
        }

        Commands::Node { id } => {
            let node: Node = get(client, &format!("{}/nodes/{}", base_url, id)).await?;
            println!("ID: {}", node.id);
            println!("Name: {}", node.name);
            println!("Path: {}", node.file_path);
            println!("Status: {}", node.status);
            println!("Description: {}", node.description);
            if let Some(code) = &node.generated_code {
                println!("\n--- Generated Code ---\n{}", code);
            }
        }

        Commands::AddNode {
            name,
            path,
            language,
            description,
        } => {
            let body = serde_json::json!({
                "name": name,
                "file_path": path,
                "language": language,
            });
            let node: Node = post(client, &format!("{}/nodes", base_url), &body).await?;

            // Update description if provided
            if !description.is_empty() {
                let update_body = serde_json::json!({ "description": description });
                let _: Value = put(client, &format!("{}/nodes/{}", base_url, node.id), &update_body).await?;
            }

            println!("Created node: {} ({})", node.name, node.id);
            println!("File path: {}", node.file_path);
        }

        Commands::UpdateNode {
            id,
            description,
            purpose,
            name,
        } => {
            let mut updates = serde_json::Map::new();
            if let Some(d) = description {
                updates.insert("description".to_string(), serde_json::Value::String(d));
            }
            if let Some(p) = purpose {
                updates.insert("purpose".to_string(), serde_json::Value::String(p));
            }
            if let Some(n) = name {
                updates.insert("name".to_string(), serde_json::Value::String(n));
            }

            if updates.is_empty() {
                return Err("No updates specified".to_string());
            }

            let _: Value = put(
                client,
                &format!("{}/nodes/{}", base_url, id),
                &serde_json::Value::Object(updates),
            )
            .await?;
            println!("Updated node: {}", id);
        }

        Commands::DeleteNode { id } => {
            let _: Value = delete(client, &format!("{}/nodes/{}", base_url, id)).await?;
            println!("Deleted node: {}", id);
        }

        Commands::Edges => {
            let edges: Vec<Edge> = get(client, &format!("{}/edges", base_url)).await?;
            if edges.is_empty() {
                println!("No edges in project");
            } else {
                println!("{:<36} {:<36} {}", "SOURCE", "TARGET", "LABEL");
                println!("{}", "-".repeat(90));
                for edge in edges {
                    println!(
                        "{:<36} {:<36} {}",
                        edge.source,
                        edge.target,
                        edge.label
                    );
                }
            }
        }

        Commands::AddEdge {
            source,
            target,
            label,
        } => {
            let body = serde_json::json!({
                "source": source,
                "target": target,
                "label": label,
            });
            let edge: Edge = post(client, &format!("{}/edges", base_url), &body).await?;
            println!("Created edge: {} -> {} ({})", source, target, edge.id);
        }

        Commands::DeleteEdge { id } => {
            let _: Value = delete(client, &format!("{}/edges/{}", base_url, id)).await?;
            println!("Deleted edge: {}", id);
        }

        Commands::Plan => {
            let plan: ExecutionPlan = get(client, &format!("{}/execution-plan", base_url)).await?;
            println!("Execution Plan ({} nodes)", plan.total_nodes);
            println!("{}", "-".repeat(50));
            for wave in plan.waves {
                println!("\nWave {}:", wave.wave_number);
                for node_id in wave.node_ids {
                    println!("  - {}", node_id);
                }
            }
        }

        Commands::Prompt { id } => {
            let resp: Value = get(client, &format!("{}/prompt/{}", base_url, id)).await?;
            if let Some(prompt) = resp.get("prompt").and_then(|p| p.as_str()) {
                println!("{}", prompt);
            }
        }

        Commands::Generate { id } => {
            println!("Generating code for node {}...", id);
            let resp: Value = post(
                client,
                &format!("{}/generate/{}", base_url, id),
                &serde_json::json!({}),
            )
            .await?;
            if let Some(code) = resp.get("code").and_then(|c| c.as_str()) {
                println!("\n--- Generated Code ---\n{}", code);
            }
        }

        Commands::GenerateAll => {
            println!("Generating code for all nodes...");
            let _: Value = post(
                client,
                &format!("{}/generate-all", base_url),
                &serde_json::json!({}),
            )
            .await?;
            println!("Generation complete!");
        }

        Commands::WriteFiles => {
            let project: Value = get(client, &format!("{}/project", base_url)).await?;

            let project_path = project.get("projectPath")
                .and_then(|p| p.as_str())
                .ok_or("No project path found")?;

            // Clean up Windows extended path prefix if present
            let project_path = project_path.trim_start_matches("\\\\?\\");

            let nodes = project.get("nodes")
                .and_then(|n| n.as_array())
                .ok_or("No nodes found")?;

            let mut written = 0;
            let mut skipped = 0;

            for node in nodes {
                let file_path = node.get("filePath").and_then(|p| p.as_str());
                let code = node.get("generatedCode").and_then(|c| c.as_str());
                let name = node.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");

                match (file_path, code) {
                    (Some(rel_path), Some(code)) if !code.is_empty() => {
                        let full_path = std::path::Path::new(project_path).join(rel_path);

                        // Create parent directories if needed
                        if let Some(parent) = full_path.parent() {
                            std::fs::create_dir_all(parent)
                                .map_err(|e| format!("Failed to create directory: {}", e))?;
                        }

                        std::fs::write(&full_path, code)
                            .map_err(|e| format!("Failed to write {}: {}", rel_path, e))?;

                        println!("  Wrote: {} -> {}", name, rel_path);
                        written += 1;
                    }
                    _ => {
                        println!("  Skipped: {} (no generated code)", name);
                        skipped += 1;
                    }
                }
            }

            println!("\nFiles written: {}, skipped: {}", written, skipped);
        }

        Commands::SetKeys {
            anthropic,
            openai,
            ollama_url,
        } => {
            let body = ApiKeysRequest {
                anthropic,
                openai,
                ollama_base_url: ollama_url,
            };
            let _: Value = post(client, &format!("{}/api-keys", base_url), &body).await?;
            println!("API keys updated");
        }

        Commands::Project => {
            let project: Value = get(client, &format!("{}/project", base_url)).await?;
            println!("{}", serde_json::to_string_pretty(&project).unwrap());
        }
    }

    Ok(())
}

async fn get<T: for<'de> Deserialize<'de>>(client: &Client, url: &str) -> Result<T, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}. Is Needlepoint running?", e))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<ErrorResponse>(&body) {
            return Err(err.error);
        }
        return Err(format!("Request failed: {} - {}", status, body));
    }

    serde_json::from_str(&body).map_err(|e| format!("Failed to parse response: {}", e))
}

async fn post<T: for<'de> Deserialize<'de>, B: Serialize>(
    client: &Client,
    url: &str,
    body: &B,
) -> Result<T, String> {
    let resp = client
        .post(url)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}. Is Needlepoint running?", e))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<ErrorResponse>(&body) {
            return Err(err.error);
        }
        return Err(format!("Request failed: {} - {}", status, body));
    }

    serde_json::from_str(&body).map_err(|e| format!("Failed to parse response: {}", e))
}

async fn put<T: for<'de> Deserialize<'de>, B: Serialize>(
    client: &Client,
    url: &str,
    body: &B,
) -> Result<T, String> {
    let resp = client
        .put(url)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}. Is Needlepoint running?", e))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<ErrorResponse>(&body) {
            return Err(err.error);
        }
        return Err(format!("Request failed: {} - {}", status, body));
    }

    serde_json::from_str(&body).map_err(|e| format!("Failed to parse response: {}", e))
}

async fn delete<T: for<'de> Deserialize<'de>>(client: &Client, url: &str) -> Result<T, String> {
    let resp = client
        .delete(url)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}. Is Needlepoint running?", e))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<ErrorResponse>(&body) {
            return Err(err.error);
        }
        return Err(format!("Request failed: {} - {}", status, body));
    }

    serde_json::from_str(&body).map_err(|e| format!("Failed to parse response: {}", e))
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}
