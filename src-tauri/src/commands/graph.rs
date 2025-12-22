use tauri::command;
use uuid::Uuid;

use crate::graph::{CodeEdge, CodeNode, EdgeType, Project};
use crate::graph::validation::would_create_cycle;

/// Add a new node to the project
#[command]
pub fn add_node(mut project: Project, node: CodeNode) -> Result<Project, String> {
    // Generate ID if empty
    let mut new_node = node;
    if new_node.id.is_empty() {
        new_node.id = Uuid::new_v4().to_string();
    }

    // Check for duplicate file path
    if project
        .nodes
        .iter()
        .any(|n| n.file_path == new_node.file_path)
    {
        return Err(format!(
            "A node with file path '{}' already exists",
            new_node.file_path
        ));
    }

    project.nodes.push(new_node);
    Ok(project)
}

/// Update an existing node
#[command]
pub fn update_node(mut project: Project, node_id: String, updates: CodeNode) -> Result<Project, String> {
    let node = project
        .find_node_mut(&node_id)
        .ok_or_else(|| format!("Node '{}' not found", node_id))?;

    // Update fields
    node.name = updates.name;
    node.file_path = updates.file_path;
    node.language = updates.language;
    node.description = updates.description;
    node.purpose = updates.purpose;
    node.exports = updates.exports;
    node.llm_config = updates.llm_config;
    node.position = updates.position;

    Ok(project)
}

/// Delete a node and its connected edges
#[command]
pub fn delete_node(mut project: Project, node_id: String) -> Result<Project, String> {
    // Remove the node
    let initial_len = project.nodes.len();
    project.nodes.retain(|n| n.id != node_id);

    if project.nodes.len() == initial_len {
        return Err(format!("Node '{}' not found", node_id));
    }

    // Remove connected edges
    project
        .edges
        .retain(|e| e.source != node_id && e.target != node_id);

    Ok(project)
}

/// Add a new edge to the project
#[command]
pub fn add_edge(
    mut project: Project,
    source: String,
    target: String,
    edge_type: EdgeType,
) -> Result<Project, String> {
    // Validate that both nodes exist
    if project.find_node(&source).is_none() {
        return Err(format!("Source node '{}' not found", source));
    }
    if project.find_node(&target).is_none() {
        return Err(format!("Target node '{}' not found", target));
    }

    // Check for self-loop
    if source == target {
        return Err("Cannot create an edge from a node to itself".to_string());
    }

    // Check if edge already exists
    if project
        .edges
        .iter()
        .any(|e| e.source == source && e.target == target)
    {
        return Err("Edge already exists".to_string());
    }

    // Check for cycles
    if would_create_cycle(&project, &source, &target) {
        return Err("Adding this edge would create a circular dependency".to_string());
    }

    let edge = CodeEdge::new(source, target, edge_type);
    project.edges.push(edge);

    Ok(project)
}

/// Delete an edge
#[command]
pub fn delete_edge(mut project: Project, edge_id: String) -> Result<Project, String> {
    let initial_len = project.edges.len();
    project.edges.retain(|e| e.id != edge_id);

    if project.edges.len() == initial_len {
        return Err(format!("Edge '{}' not found", edge_id));
    }

    Ok(project)
}
