use serde::{Deserialize, Serialize};

use crate::graph::model::NodeStatus;

/// Progress update for a single node
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeProgress {
    pub node_id: String,
    pub status: NodeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_code: Option<String>,
}

/// Events emitted during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ExecutionEvent {
    /// Execution has started
    #[serde(rename_all = "camelCase")]
    Started {
        total_nodes: usize,
        total_waves: usize,
    },

    /// A new wave has started
    #[serde(rename_all = "camelCase")]
    WaveStarted {
        wave_number: usize,
        node_ids: Vec<String>,
    },

    /// A node's status has changed
    #[serde(rename_all = "camelCase")]
    NodeUpdate(NodeProgress),

    /// A wave has completed
    #[serde(rename_all = "camelCase")]
    WaveCompleted {
        wave_number: usize,
        successful: usize,
        failed: usize,
    },

    /// Execution completed
    #[serde(rename_all = "camelCase")]
    Completed {
        total_successful: usize,
        total_failed: usize,
        total_skipped: usize,
    },

    /// Execution was cancelled
    Cancelled,

    /// Execution error (not a node error, but system error)
    #[serde(rename_all = "camelCase")]
    Error {
        message: String,
    },
}

/// The event channel name for execution events
pub const EXECUTION_EVENT_CHANNEL: &str = "execution-progress";
