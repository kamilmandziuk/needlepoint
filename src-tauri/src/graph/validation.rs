use std::collections::{HashMap, HashSet};

use petgraph::algo::is_cyclic_directed;
use petgraph::graph::DiGraph;

use super::model::Project;

/// Validation error types
#[derive(Debug, Clone)]
pub enum ValidationError {
    CyclicDependency(Vec<String>),
    OrphanNode(String),
    MissingNode(String),
    DuplicateFilePath(String, Vec<String>),
}

/// Validation warning types
#[derive(Debug, Clone)]
pub enum ValidationWarning {
    EmptyDescription(String),
    NoExports(String),
    UnreachableNode(String),
}

/// Result of validating a project
#[derive(Debug, Clone, Default)]
pub struct ValidationResult {
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

impl ValidationResult {
    pub fn is_valid(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn has_warnings(&self) -> bool {
        !self.warnings.is_empty()
    }
}

/// Validate the project graph structure
pub fn validate_project(project: &Project) -> ValidationResult {
    let mut result = ValidationResult::default();

    // Build a graph for cycle detection
    let mut graph = DiGraph::<&str, ()>::new();
    let mut node_indices: HashMap<&str, petgraph::graph::NodeIndex> = HashMap::new();

    // Add all nodes to the graph
    for node in &project.nodes {
        let idx = graph.add_node(node.id.as_str());
        node_indices.insert(node.id.as_str(), idx);
    }

    // Add edges
    for edge in &project.edges {
        let source_idx = node_indices.get(edge.source.as_str());
        let target_idx = node_indices.get(edge.target.as_str());

        match (source_idx, target_idx) {
            (Some(&s), Some(&t)) => {
                graph.add_edge(s, t, ());
            }
            (None, _) => {
                result
                    .errors
                    .push(ValidationError::MissingNode(edge.source.clone()));
            }
            (_, None) => {
                result
                    .errors
                    .push(ValidationError::MissingNode(edge.target.clone()));
            }
        }
    }

    // Check for cycles
    if is_cyclic_directed(&graph) {
        // TODO: Extract the actual cycle path
        result.errors.push(ValidationError::CyclicDependency(vec![
            "Cycle detected in graph".to_string(),
        ]));
    }

    // Check for duplicate file paths
    let mut file_paths: HashMap<&str, Vec<&str>> = HashMap::new();
    for node in &project.nodes {
        file_paths
            .entry(node.file_path.as_str())
            .or_default()
            .push(node.id.as_str());
    }
    for (path, ids) in file_paths {
        if ids.len() > 1 {
            result.errors.push(ValidationError::DuplicateFilePath(
                path.to_string(),
                ids.iter().map(|s| s.to_string()).collect(),
            ));
        }
    }

    // Check for nodes without edges (orphans) - warning only
    let nodes_in_edges: HashSet<&str> = project
        .edges
        .iter()
        .flat_map(|e| vec![e.source.as_str(), e.target.as_str()])
        .collect();

    for node in &project.nodes {
        if !nodes_in_edges.contains(node.id.as_str()) && project.nodes.len() > 1 {
            result
                .warnings
                .push(ValidationWarning::UnreachableNode(node.id.clone()));
        }
    }

    // Check for missing descriptions/exports - warnings
    for node in &project.nodes {
        if node.description.is_empty() {
            result
                .warnings
                .push(ValidationWarning::EmptyDescription(node.id.clone()));
        }
        if node.exports.is_empty() {
            result
                .warnings
                .push(ValidationWarning::NoExports(node.id.clone()));
        }
    }

    result
}

/// Check if adding an edge would create a cycle
pub fn would_create_cycle(project: &Project, source: &str, target: &str) -> bool {
    let mut graph = DiGraph::<&str, ()>::new();
    let mut node_indices: HashMap<&str, petgraph::graph::NodeIndex> = HashMap::new();

    // Add all nodes
    for node in &project.nodes {
        let idx = graph.add_node(node.id.as_str());
        node_indices.insert(node.id.as_str(), idx);
    }

    // Add existing edges
    for edge in &project.edges {
        if let (Some(&s), Some(&t)) = (
            node_indices.get(edge.source.as_str()),
            node_indices.get(edge.target.as_str()),
        ) {
            graph.add_edge(s, t, ());
        }
    }

    // Add the proposed edge
    if let (Some(&s), Some(&t)) = (node_indices.get(source), node_indices.get(target)) {
        graph.add_edge(s, t, ());
        is_cyclic_directed(&graph)
    } else {
        false
    }
}
