use crate::graph::model::{CodeNode, Project, ExportSignature};
use regex::Regex;

/// Builds context/prompts for code generation based on node and its dependencies
pub struct ContextBuilder;

impl ContextBuilder {
    /// Build a complete prompt for generating code for a node
    pub fn build_prompt(project: &Project, node_id: &str) -> Option<String> {
        let node = project.find_node(node_id)?;

        let mut prompt = String::new();

        // Header with file info
        prompt.push_str(&format!(
            "You are implementing a {} module.\n\n",
            format_language(&node.language.to_string())
        ));

        prompt.push_str(&format!("## File: {}\n", node.file_path));

        if !node.purpose.is_empty() {
            prompt.push_str(&format!("## Purpose: {}\n\n", node.purpose));
        }

        if !node.description.is_empty() {
            prompt.push_str(&format!("## Description\n{}\n\n", node.description));
        }

        // Exports to implement
        if !node.exports.is_empty() {
            prompt.push_str("## You must export:\n");
            for export in &node.exports {
                prompt.push_str(&format_export(export));
            }
            prompt.push('\n');
        }

        // Dependencies context - include actual generated code from dependencies
        let dependencies = Self::get_dependencies(project, node_id);
        if !dependencies.is_empty() {
            prompt.push_str("## Dependencies (you can import from these files):\n\n");
            for (dep_node, edge_type) in &dependencies {
                prompt.push_str(&format!("### {} `{}`\n", edge_type, dep_node.file_path));

                // Include the actual generated code if available
                if let Some(ref code) = dep_node.generated_code {
                    prompt.push_str("```\n");
                    prompt.push_str(code);
                    if !code.ends_with('\n') {
                        prompt.push('\n');
                    }
                    prompt.push_str("```\n\n");
                } else {
                    // Fallback to export signatures if code not yet generated
                    prompt.push_str("Exports:\n");
                    for export in &dep_node.exports {
                        prompt.push_str(&format!("- {}: {}\n", export.name, export.type_signature));
                        if !export.description.is_empty() {
                            prompt.push_str(&format!("  {}\n", export.description));
                        }
                    }
                    prompt.push('\n');
                }
            }
        }

        // Constraints
        if !node.llm_config.constraints.is_empty() {
            prompt.push_str("## Constraints:\n");
            for constraint in &node.llm_config.constraints {
                prompt.push_str(&format!("- {}\n", constraint));
            }
            prompt.push('\n');
        }

        prompt.push_str("Generate the complete implementation.\n\n");
        prompt.push_str("IMPORTANT: Output ONLY the raw code. Do NOT wrap the code in markdown code blocks (``` or ```typescript). Do NOT include any explanations, comments about the code, or surrounding text. The output should be directly usable as a source file.");

        Some(prompt)
    }

    /// Build a system prompt for the LLM
    pub fn build_system_prompt(node: &CodeNode) -> String {
        let base = format!(
            "You are an expert {} programmer. Generate clean, well-documented, production-ready code.",
            format_language(&node.language.to_string())
        );

        if let Some(custom) = &node.llm_config.system_prompt {
            format!("{}\n\n{}", base, custom)
        } else {
            base
        }
    }

    /// Get all nodes that this node depends on (incoming edges)
    fn get_dependencies<'a>(project: &'a Project, node_id: &str) -> Vec<(&'a CodeNode, String)> {
        let mut deps = Vec::new();

        for edge in &project.edges {
            // Node depends on source of incoming edge (edge points TO this node)
            if edge.target == node_id {
                if let Some(source_node) = project.find_node(&edge.source) {
                    // Use the edge label, or default to "dependency" if empty
                    let label = if edge.label.is_empty() {
                        "dependency".to_string()
                    } else {
                        edge.label.clone()
                    };
                    deps.push((source_node, label));
                }
            }
        }

        deps
    }
}

fn format_language(lang: &str) -> String {
    match lang.to_lowercase().as_str() {
        "typescript" => "TypeScript".to_string(),
        "javascript" => "JavaScript".to_string(),
        "python" => "Python".to_string(),
        "rust" => "Rust".to_string(),
        "go" => "Go".to_string(),
        other => other.to_string(),
    }
}

fn format_export(export: &ExportSignature) -> String {
    let mut result = format!("- {}", export.name);

    if !export.type_signature.is_empty() {
        result.push_str(&format!(": {}", export.type_signature));
    }

    result.push('\n');

    if !export.description.is_empty() {
        result.push_str(&format!("  {}\n", export.description));
    }

    result
}

/// Strip markdown code blocks from LLM output
/// Handles formats like ```typescript\n...\n``` or ```\n...\n```
pub fn strip_code_blocks(content: &str) -> String {
    let content = content.trim();

    // Try to match code block pattern: ```language\n...\n``` or ```\n...\n```
    let re = Regex::new(r"^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$").unwrap();

    if let Some(caps) = re.captures(content) {
        if let Some(code) = caps.get(1) {
            return code.as_str().trim().to_string();
        }
    }

    // If no code block found, return original content trimmed
    content.to_string()
}
