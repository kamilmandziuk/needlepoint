// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod graph;
mod llm;
mod orchestration;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
