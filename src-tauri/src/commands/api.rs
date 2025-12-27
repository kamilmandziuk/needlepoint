use std::sync::Arc;
use tauri::{command, State};

use crate::api::state::AppState;

/// Get the HTTP API server port
#[command]
pub async fn get_api_port(state: State<'_, Arc<AppState>>) -> Result<Option<u16>, String> {
    Ok(*state.port.read().await)
}
