//! WebSocket Server for Peer Connections
//!
//! Provides a tokio-tungstenite WebSocket server for real-time
//! collaboration peer connections. Handles message routing,
//! room-level broadcasting, and connection lifecycle.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use futures::stream::SplitSink;
use futures::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex as TokioMutex, RwLock, broadcast};
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

use crate::collab::types::CollabMessage;

type WsSink = SplitSink<WebSocketStream<TcpStream>, Message>;

/// Represents a connected peer
struct PeerConnection {
    user_id: String,
    session_id: Option<String>,
    sink: Arc<TokioMutex<WsSink>>,
}

/// Room-level broadcast channel
struct RoomBroadcast {
    tx: broadcast::Sender<String>,
}

/// WebSocket server for collaboration
pub struct CollabServer {
    port: u16,
    peers: Arc<RwLock<HashMap<SocketAddr, PeerConnection>>>,
    rooms: Arc<RwLock<HashMap<String, RoomBroadcast>>>,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
    is_running: bool,
}

impl CollabServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            peers: Arc::new(RwLock::new(HashMap::new())),
            rooms: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx: None,
            is_running: false,
        }
    }

    /// Start the WebSocket server
    pub async fn start(&mut self) -> Result<u16, String> {
        if self.is_running {
            return Ok(self.port);
        }

        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind WebSocket server to {}: {}", addr, e))?;

        let actual_port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?
            .port();

        self.port = actual_port;
        self.is_running = true;

        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel();
        self.shutdown_tx = Some(shutdown_tx);

        let peers = self.peers.clone();
        let rooms = self.rooms.clone();

        info!(
            "Collaboration WebSocket server starting on port {}",
            actual_port
        );

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((stream, addr)) => {
                                let peers = peers.clone();
                                let rooms = rooms.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(stream, addr, peers, rooms).await {
                                        warn!("WebSocket connection error from {}: {}", addr, e);
                                    }
                                });
                            }
                            Err(e) => {
                                error!("Failed to accept WebSocket connection: {}", e);
                            }
                        }
                    }
                    _ = &mut shutdown_rx => {
                        info!("Collaboration WebSocket server shutting down");
                        break;
                    }
                }
            }
        });

        Ok(actual_port)
    }

    /// Stop the WebSocket server
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        self.is_running = false;
        info!("Collaboration WebSocket server stopped");
    }

    /// Check if the server is running
    pub fn is_running(&self) -> bool {
        self.is_running
    }

    /// Get the server port
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Broadcast a message to all peers in a specific session/room
    pub async fn broadcast_to_room(
        &self,
        session_id: &str,
        message: &CollabMessage,
        exclude_addr: Option<SocketAddr>,
    ) {
        let msg_json = match serde_json::to_string(message) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize collab message: {}", e);
                return;
            }
        };

        let peers = self.peers.read().await;
        for (peer_addr, peer) in peers.iter() {
            if peer.session_id.as_deref() == Some(session_id) {
                if let Some(exclude) = exclude_addr {
                    if *peer_addr == exclude {
                        continue;
                    }
                }
                let sink = peer.sink.clone();
                let msg = msg_json.clone();
                tokio::spawn(async move {
                    let mut sink = sink.lock().await;
                    if let Err(e) = sink.send(Message::Text(msg)).await {
                        warn!("Failed to send message to peer: {}", e);
                    }
                });
            }
        }
    }
}

impl Default for CollabServer {
    fn default() -> Self {
        Self::new(4097)
    }
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    addr: SocketAddr,
    peers: Arc<RwLock<HashMap<SocketAddr, PeerConnection>>>,
    rooms: Arc<RwLock<HashMap<String, RoomBroadcast>>>,
) -> Result<(), String> {
    let ws_stream = tokio_tungstenite::accept_async(stream)
        .await
        .map_err(|e| format!("WebSocket handshake failed: {}", e))?;

    info!("New WebSocket connection from: {}", addr);

    let (sink, mut stream) = ws_stream.split();
    let sink = Arc::new(TokioMutex::new(sink));

    // Register the peer with a temporary ID
    {
        let mut peers_guard = peers.write().await;
        peers_guard.insert(
            addr,
            PeerConnection {
                user_id: String::new(),
                session_id: None,
                sink: sink.clone(),
            },
        );
    }

    // Process incoming messages
    while let Some(msg_result) = stream.next().await {
        match msg_result {
            Ok(Message::Text(text)) => match serde_json::from_str::<CollabMessage>(&text) {
                Ok(collab_msg) => {
                    handle_collab_message(&collab_msg, addr, &peers, &rooms, &sink).await;
                }
                Err(e) => {
                    warn!("Invalid message from {}: {}", addr, e);
                    let error_msg = CollabMessage::Error {
                        message: format!("Invalid message format: {}", e),
                    };
                    let mut sink_guard = sink.lock().await;
                    let _ = sink_guard
                        .send(Message::Text(
                            serde_json::to_string(&error_msg).unwrap_or_default(),
                        ))
                        .await;
                }
            },
            Ok(Message::Ping(data)) => {
                let mut sink_guard = sink.lock().await;
                let _ = sink_guard.send(Message::Pong(data)).await;
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket connection closed by peer: {}", addr);
                break;
            }
            Err(e) => {
                warn!("WebSocket error from {}: {}", addr, e);
                break;
            }
            _ => {}
        }
    }

    // Clean up peer on disconnect
    let mut peers_guard = peers.write().await;
    if let Some(peer) = peers_guard.remove(&addr) {
        info!(
            "Peer disconnected: {} (user: {})",
            addr,
            if peer.user_id.is_empty() {
                "unknown"
            } else {
                &peer.user_id
            }
        );

        // Notify room about user leaving
        if let Some(session_id) = &peer.session_id {
            if !peer.user_id.is_empty() {
                let leave_msg = CollabMessage::UserLeft {
                    user_id: peer.user_id.clone(),
                };
                broadcast_to_peers(&peers_guard, session_id, &leave_msg, Some(addr));
            }
        }
    }

    Ok(())
}

/// Broadcast a message to all peers in a session, optionally excluding one address
fn broadcast_to_peers(
    peers: &HashMap<SocketAddr, PeerConnection>,
    session_id: &str,
    message: &CollabMessage,
    exclude: Option<SocketAddr>,
) {
    let msg_json = serde_json::to_string(message).unwrap_or_default();

    for (peer_addr, peer) in peers.iter() {
        if peer.session_id.as_deref() == Some(session_id) {
            if let Some(ex) = exclude {
                if *peer_addr == ex {
                    continue;
                }
            }
            let sink = peer.sink.clone();
            let msg = msg_json.clone();
            tokio::spawn(async move {
                let mut sink = sink.lock().await;
                let _ = sink.send(Message::Text(msg)).await;
            });
        }
    }
}

/// Handle a parsed collaboration message
async fn handle_collab_message(
    message: &CollabMessage,
    addr: SocketAddr,
    peers: &Arc<RwLock<HashMap<SocketAddr, PeerConnection>>>,
    rooms: &Arc<RwLock<HashMap<String, RoomBroadcast>>>,
    sink: &Arc<TokioMutex<WsSink>>,
) {
    match message {
        CollabMessage::JoinRoom { session_id, user } => {
            // Update peer info
            {
                let mut peers_guard = peers.write().await;
                if let Some(peer) = peers_guard.get_mut(&addr) {
                    peer.user_id = user.id.clone();
                    peer.session_id = Some(session_id.clone());
                }
            }

            // Ensure room broadcast channel exists
            {
                let mut rooms_guard = rooms.write().await;
                rooms_guard.entry(session_id.clone()).or_insert_with(|| {
                    let (tx, _) = broadcast::channel(256);
                    RoomBroadcast { tx }
                });
            }

            // Broadcast user joined to other peers in the room
            let join_msg = CollabMessage::UserJoined { user: user.clone() };

            let peers_guard = peers.read().await;
            broadcast_to_peers(&peers_guard, session_id, &join_msg, Some(addr));

            info!(
                "User '{}' joined room '{}' from {}",
                user.name, session_id, addr
            );
        }

        CollabMessage::LeaveRoom {
            session_id,
            user_id,
        } => {
            // Update peer info
            {
                let mut peers_guard = peers.write().await;
                if let Some(peer) = peers_guard.get_mut(&addr) {
                    peer.session_id = None;
                }
            }

            // Broadcast user left
            let leave_msg = CollabMessage::UserLeft {
                user_id: user_id.clone(),
            };

            let peers_guard = peers.read().await;
            broadcast_to_peers(&peers_guard, session_id, &leave_msg, Some(addr));
        }

        CollabMessage::CursorUpdate { .. }
        | CollabMessage::SelectionUpdate { .. }
        | CollabMessage::DocumentSync { .. }
        | CollabMessage::AwarenessUpdate { .. }
        | CollabMessage::ChatMessage { .. } => {
            // Forward to all peers in the same room (except sender)
            let session_id = {
                let peers_guard = peers.read().await;
                peers_guard.get(&addr).and_then(|p| p.session_id.clone())
            };

            if let Some(session_id) = session_id {
                let peers_guard = peers.read().await;
                broadcast_to_peers(&peers_guard, &session_id, message, Some(addr));
            }
        }

        CollabMessage::Ping => {
            let pong = CollabMessage::Pong;
            let mut sink_guard = sink.lock().await;
            let _ = sink_guard
                .send(Message::Text(
                    serde_json::to_string(&pong).unwrap_or_default(),
                ))
                .await;
        }

        _ => {}
    }
}
