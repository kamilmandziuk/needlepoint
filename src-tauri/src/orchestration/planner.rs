use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::graph::model::Project;

/// A wave of nodes that can be generated in parallel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionWave {
    /// Wave number (0-indexed)
    pub wave_number: usize,
    /// Node IDs in this wave
    pub node_ids: Vec<String>,
}

/// The complete execution plan showing how nodes will be generated
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionPlan {
    /// Ordered waves of execution
    pub waves: Vec<ExecutionWave>,
    /// Total number of nodes to generate
    pub total_nodes: usize,
    /// Nodes that cannot be generated (cycle detected or orphaned)
    pub skipped_nodes: Vec<String>,
}

impl ExecutionPlan {
    /// Create an execution plan from a project using topological sort
    pub fn from_project(project: &Project) -> Self {
        let node_ids: HashSet<String> = project.nodes.iter().map(|n| n.id.clone()).collect();

        // Build adjacency list: target -> sources (dependencies)
        // An edge from A -> B means B depends on A (B is target, A is source)
        let mut dependencies: HashMap<String, HashSet<String>> = HashMap::new();
        let mut dependents: HashMap<String, HashSet<String>> = HashMap::new();

        for node_id in &node_ids {
            dependencies.insert(node_id.clone(), HashSet::new());
            dependents.insert(node_id.clone(), HashSet::new());
        }

        for edge in &project.edges {
            // target depends on source
            if let Some(deps) = dependencies.get_mut(&edge.target) {
                deps.insert(edge.source.clone());
            }
            // source has dependent target
            if let Some(deps) = dependents.get_mut(&edge.source) {
                deps.insert(edge.target.clone());
            }
        }

        // Kahn's algorithm for topological sort with wave detection
        let mut waves: Vec<ExecutionWave> = Vec::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut remaining: HashSet<String> = node_ids.clone();

        // Calculate initial in-degrees
        for node_id in &node_ids {
            let degree = dependencies.get(node_id).map(|d| d.len()).unwrap_or(0);
            in_degree.insert(node_id.clone(), degree);
        }

        let mut wave_number = 0;

        while !remaining.is_empty() {
            // Find all nodes with in-degree 0 (no remaining dependencies)
            let ready: Vec<String> = remaining
                .iter()
                .filter(|id| *in_degree.get(*id).unwrap_or(&0) == 0)
                .cloned()
                .collect();

            if ready.is_empty() {
                // No nodes with in-degree 0 means we have a cycle
                // This shouldn't happen if cycle detection is working, but handle gracefully
                break;
            }

            // Add this wave
            waves.push(ExecutionWave {
                wave_number,
                node_ids: ready.clone(),
            });

            // Remove processed nodes and update in-degrees
            for node_id in &ready {
                remaining.remove(node_id);

                // Decrease in-degree of dependents
                if let Some(node_dependents) = dependents.get(node_id) {
                    for dependent in node_dependents {
                        if let Some(degree) = in_degree.get_mut(dependent) {
                            *degree = degree.saturating_sub(1);
                        }
                    }
                }
            }

            wave_number += 1;
        }

        let total_nodes: usize = waves.iter().map(|w| w.node_ids.len()).sum();
        let skipped_nodes: Vec<String> = remaining.into_iter().collect();

        ExecutionPlan {
            waves,
            total_nodes,
            skipped_nodes,
        }
    }

    /// Get a flattened list of node IDs in execution order
    pub fn ordered_node_ids(&self) -> Vec<String> {
        self.waves
            .iter()
            .flat_map(|w| w.node_ids.clone())
            .collect()
    }

    /// Check if a specific node ID is in the plan
    pub fn contains_node(&self, node_id: &str) -> bool {
        self.waves.iter().any(|w| w.node_ids.contains(&node_id.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::model::{CodeNode, CodeEdge, EdgeType, Language, ProjectManifest};

    fn create_test_project() -> Project {
        let mut project = Project {
            manifest: ProjectManifest::default(),
            nodes: vec![],
            edges: vec![],
            project_path: String::new(),
        };

        // Create nodes: A, B, C where B depends on A, C depends on B
        let node_a = CodeNode::new("A".to_string(), "a.ts".to_string(), Language::TypeScript);
        let node_b = CodeNode::new("B".to_string(), "b.ts".to_string(), Language::TypeScript);
        let node_c = CodeNode::new("C".to_string(), "c.ts".to_string(), Language::TypeScript);

        let id_a = node_a.id.clone();
        let id_b = node_b.id.clone();
        let id_c = node_c.id.clone();

        project.nodes = vec![node_a, node_b, node_c];

        // B depends on A (edge from A to B means B imports from A)
        project.edges = vec![
            CodeEdge::new(id_a.clone(), id_b.clone(), EdgeType::Imports),
            CodeEdge::new(id_b.clone(), id_c.clone(), EdgeType::Imports),
        ];

        project
    }

    #[test]
    fn test_execution_plan_linear() {
        let project = create_test_project();
        let plan = ExecutionPlan::from_project(&project);

        assert_eq!(plan.waves.len(), 3);
        assert_eq!(plan.total_nodes, 3);
        assert!(plan.skipped_nodes.is_empty());

        // Wave 0: A (no dependencies)
        // Wave 1: B (depends on A)
        // Wave 2: C (depends on B)
        assert_eq!(plan.waves[0].node_ids.len(), 1);
        assert_eq!(plan.waves[1].node_ids.len(), 1);
        assert_eq!(plan.waves[2].node_ids.len(), 1);
    }

    #[test]
    fn test_execution_plan_parallel() {
        let mut project = Project {
            manifest: ProjectManifest::default(),
            nodes: vec![],
            edges: vec![],
            project_path: String::new(),
        };

        // Create nodes: A, B, C, D where C depends on A and B, D depends on C
        let node_a = CodeNode::new("A".to_string(), "a.ts".to_string(), Language::TypeScript);
        let node_b = CodeNode::new("B".to_string(), "b.ts".to_string(), Language::TypeScript);
        let node_c = CodeNode::new("C".to_string(), "c.ts".to_string(), Language::TypeScript);
        let node_d = CodeNode::new("D".to_string(), "d.ts".to_string(), Language::TypeScript);

        let id_a = node_a.id.clone();
        let id_b = node_b.id.clone();
        let id_c = node_c.id.clone();
        let id_d = node_d.id.clone();

        project.nodes = vec![node_a, node_b, node_c, node_d];
        project.edges = vec![
            CodeEdge::new(id_a.clone(), id_c.clone(), EdgeType::Imports),
            CodeEdge::new(id_b.clone(), id_c.clone(), EdgeType::Imports),
            CodeEdge::new(id_c.clone(), id_d.clone(), EdgeType::Imports),
        ];

        let plan = ExecutionPlan::from_project(&project);

        assert_eq!(plan.waves.len(), 3);
        assert_eq!(plan.total_nodes, 4);

        // Wave 0: A and B (no dependencies) - can run in parallel
        assert_eq!(plan.waves[0].node_ids.len(), 2);
        // Wave 1: C (depends on A and B)
        assert_eq!(plan.waves[1].node_ids.len(), 1);
        // Wave 2: D (depends on C)
        assert_eq!(plan.waves[2].node_ids.len(), 1);
    }
}
