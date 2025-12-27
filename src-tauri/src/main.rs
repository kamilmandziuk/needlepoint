// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod graph;
mod llm;
mod orchestration;

use std::sync::Arc;
use api::state::AppState;

fn main() {
    // Create shared state for HTTP API
    let app_state = AppState::new();
    let app_state_clone = Arc::clone(&app_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(app_state)
        .setup(move |_app| {
            // Start HTTP API server in background
            let state = app_state_clone;
            tauri::async_runtime::spawn(async move {
                match api::start_server(state).await {
                    Ok(port) => {
                        println!("Needlepoint HTTP API started on http://127.0.0.1:{}", port);
                    }
                    Err(e) => {
                        eprintln!("Failed to start HTTP API server: {}", e);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project::load_project,
            commands::project::save_project,
            commands::graph::add_node,
            commands::graph::update_node,
            commands::graph::delete_node,
            commands::graph::add_edge,
            commands::graph::delete_edge,
            commands::graph::check_would_create_cycle,
            commands::generation::generate_node,
            commands::generation::preview_prompt,
            commands::orchestration::get_execution_plan,
            commands::orchestration::generate_all,
            commands::orchestration::generate_nodes,
            commands::filesystem::create_file,
            commands::filesystem::write_file,
            commands::filesystem::delete_file,
            commands::filesystem::delete_file_permanent,
            commands::filesystem::restore_file,
            commands::filesystem::list_trash,
            commands::filesystem::empty_trash,
            commands::filesystem::rename_file,
            commands::filesystem::file_exists,
            commands::filesystem::create_directory,
            commands::api::get_api_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
