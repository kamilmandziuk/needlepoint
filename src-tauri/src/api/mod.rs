pub mod routes;
pub mod state;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use state::AppState;

/// Default port for the HTTP API
pub const DEFAULT_PORT: u16 = 9999;

/// Start the HTTP API server
/// Returns the port it's running on
pub async fn start_server(state: Arc<AppState>) -> Result<u16, std::io::Error> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", routes::create_routes())
        .layer(cors)
        .with_state(Arc::clone(&state));

    // Try to bind to default port, fall back to random port
    let addr = SocketAddr::from(([127, 0, 0, 1], DEFAULT_PORT));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(_) => {
            // Port in use, try random port
            tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?
        }
    };

    let port = listener.local_addr()?.port();

    // Store the port in state
    *state.port.write().await = Some(port);

    // Spawn the server in a background task
    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok(port)
}
