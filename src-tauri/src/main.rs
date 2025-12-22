// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod graph;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::load_project,
            commands::project::save_project,
            commands::graph::add_node,
            commands::graph::update_node,
            commands::graph::delete_node,
            commands::graph::add_edge,
            commands::graph::delete_edge,
            commands::graph::check_would_create_cycle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
