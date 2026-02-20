//! Collaboration Types
//!
//! Shared type definitions for the real-time collaboration system.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Permission level for a collaboration participant
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CollabPermission {
    Owner,
    Editor,
    Viewer,
}

impl Default for CollabPermission {
    fn default() -> Self {
        Self::Editor
    }
}

/// Cursor position in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPosition {
    pub file_id: String,
    pub line: u32,
    pub column: u32,
    pub timestamp: u64,
}

/// Text selection range in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRange {
    pub file_id: String,
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub timestamp: u64,
}

/// A participant in a collaboration session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabParticipant {
    pub id: String,
    pub name: String,
    pub color: String,
    pub permission: CollabPermission,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub joined_at: u64,
}

/// Information about a collaboration session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabSessionInfo {
    pub id: String,
    pub name: String,
    pub host_id: String,
    pub created_at: u64,
    pub participants: Vec<CollabParticipant>,
    pub document_ids: Vec<String>,
    pub server_port: u16,
}

/// Internal session state (not serialized to frontend directly)
#[derive(Debug, Clone)]
pub struct CollabSession {
    pub id: String,
    pub name: String,
    pub host_id: String,
    pub created_at: u64,
    pub participants: HashMap<String, CollabParticipant>,
    pub document_ids: Vec<String>,
}

impl CollabSession {
    pub fn to_info(&self, server_port: u16) -> CollabSessionInfo {
        CollabSessionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            host_id: self.host_id.clone(),
            created_at: self.created_at,
            participants: self.participants.values().cloned().collect(),
            document_ids: self.document_ids.clone(),
            server_port,
        }
    }
}

/// WebSocket protocol message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "snake_case")]
pub enum CollabMessage {
    /// Join a session room
    JoinRoom {
        session_id: String,
        user: CollabParticipant,
    },
    /// Leave a session room
    LeaveRoom {
        session_id: String,
        user_id: String,
    },
    /// Full room state broadcast
    RoomState {
        session: CollabSessionInfo,
    },
    /// A user joined the room
    UserJoined {
        user: CollabParticipant,
    },
    /// A user left the room
    UserLeft {
        user_id: String,
    },
    /// Cursor position update
    CursorUpdate {
        user_id: String,
        cursor: CursorPosition,
    },
    /// Selection range update
    SelectionUpdate {
        user_id: String,
        selection: SelectionRange,
    },
    /// CRDT document sync update (binary encoded as base64)
    DocumentSync {
        file_id: String,
        update: String,
    },
    /// Document state vector request
    SyncRequest {
        file_id: String,
        state_vector: String,
    },
    /// Awareness state update
    AwarenessUpdate {
        states: HashMap<String, AwarenessEntry>,
    },
    /// Chat message
    ChatMessage {
        id: String,
        user_id: String,
        user_name: String,
        user_color: String,
        content: String,
        timestamp: u64,
    },
    /// Ping/pong for keepalive
    Ping,
    Pong,
    /// Error message
    Error {
        message: String,
    },
}

/// Awareness entry for a single user
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwarenessEntry {
    pub user_id: String,
    pub user_name: String,
    pub user_color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub active_file: Option<String>,
    pub timestamp: u64,
}

/// User colors for remote cursors - vibrant and distinguishable
pub const USER_COLORS: &[&str] = &[
    "#f97316", // orange
    "#22c55e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
    "#8b5cf6", // violet
];

/// Get a color for a user based on their index
pub fn color_for_index(index: usize) -> String {
    USER_COLORS[index % USER_COLORS.len()].to_string()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    fn make_cursor() -> CursorPosition {
        CursorPosition {
            file_id: "file1.rs".into(),
            line: 10,
            column: 5,
            timestamp: 1000,
        }
    }

    fn make_selection() -> SelectionRange {
        SelectionRange {
            file_id: "file1.rs".into(),
            start_line: 1,
            start_column: 0,
            end_line: 3,
            end_column: 20,
            timestamp: 2000,
        }
    }

    fn make_participant(id: &str) -> CollabParticipant {
        CollabParticipant {
            id: id.into(),
            name: format!("User {id}"),
            color: "#f97316".into(),
            permission: CollabPermission::Editor,
            cursor: None,
            selection: None,
            joined_at: 5000,
        }
    }

    #[test]
    fn collab_permission_default() {
        assert_eq!(CollabPermission::default(), CollabPermission::Editor);
    }

    #[test]
    fn collab_permission_serde_roundtrip() {
        let variants = [
            (CollabPermission::Owner, "\"owner\""),
            (CollabPermission::Editor, "\"editor\""),
            (CollabPermission::Viewer, "\"viewer\""),
        ];
        for (variant, expected_json) in &variants {
            let json = serde_json::to_string(variant).unwrap();
            assert_eq!(&json, expected_json);
            let deserialized: CollabPermission = serde_json::from_str(&json).unwrap();
            assert_eq!(&deserialized, variant);
        }
    }

    #[test]
    fn cursor_position_serde_roundtrip() {
        let cursor = make_cursor();
        let json = serde_json::to_string(&cursor).unwrap();
        assert!(json.contains("\"fileId\""));
        assert!(json.contains("\"line\""));
        assert!(json.contains("\"column\""));
        assert!(json.contains("\"timestamp\""));
        let deserialized: CursorPosition = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_id, "file1.rs");
        assert_eq!(deserialized.line, 10);
        assert_eq!(deserialized.column, 5);
        assert_eq!(deserialized.timestamp, 1000);
    }

    #[test]
    fn selection_range_serde_roundtrip() {
        let sel = make_selection();
        let json = serde_json::to_string(&sel).unwrap();
        assert!(json.contains("\"fileId\""));
        assert!(json.contains("\"startLine\""));
        assert!(json.contains("\"startColumn\""));
        assert!(json.contains("\"endLine\""));
        assert!(json.contains("\"endColumn\""));
        assert!(json.contains("\"timestamp\""));
        let deserialized: SelectionRange = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_id, "file1.rs");
        assert_eq!(deserialized.start_line, 1);
        assert_eq!(deserialized.start_column, 0);
        assert_eq!(deserialized.end_line, 3);
        assert_eq!(deserialized.end_column, 20);
        assert_eq!(deserialized.timestamp, 2000);
    }

    #[test]
    fn collab_participant_serde_roundtrip() {
        let participant = make_participant("u1");
        let json = serde_json::to_string(&participant).unwrap();
        assert!(json.contains("\"joinedAt\""));
        let deserialized: CollabParticipant = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "u1");
        assert_eq!(deserialized.name, "User u1");
        assert!(deserialized.cursor.is_none());
        assert!(deserialized.selection.is_none());
    }

    #[test]
    fn collab_participant_with_cursor() {
        let mut participant = make_participant("u2");
        participant.cursor = Some(make_cursor());
        let json = serde_json::to_string(&participant).unwrap();
        assert!(json.contains("\"cursor\""));
        assert!(json.contains("\"fileId\""));
        let deserialized: CollabParticipant = serde_json::from_str(&json).unwrap();
        let cursor = deserialized.cursor.expect("cursor should be Some");
        assert_eq!(cursor.file_id, "file1.rs");
        assert_eq!(cursor.line, 10);
    }

    #[test]
    fn collab_session_info_serde_roundtrip() {
        let info = CollabSessionInfo {
            id: "sess1".into(),
            name: "Test Session".into(),
            host_id: "host1".into(),
            created_at: 9000,
            participants: vec![make_participant("u1")],
            document_ids: vec!["doc1.rs".into()],
            server_port: 8080,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"hostId\""));
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"documentIds\""));
        assert!(json.contains("\"serverPort\""));
        let deserialized: CollabSessionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "sess1");
        assert_eq!(deserialized.server_port, 8080);
        assert_eq!(deserialized.participants.len(), 1);
    }

    #[test]
    fn collab_session_to_info() {
        let mut participants = HashMap::new();
        let p = make_participant("u1");
        participants.insert("u1".into(), p);

        let session = CollabSession {
            id: "sess1".into(),
            name: "My Session".into(),
            host_id: "host1".into(),
            created_at: 9000,
            participants,
            document_ids: vec!["doc1.rs".into()],
        };

        let info = session.to_info(8080);
        assert_eq!(info.id, "sess1");
        assert_eq!(info.name, "My Session");
        assert_eq!(info.host_id, "host1");
        assert_eq!(info.created_at, 9000);
        assert_eq!(info.server_port, 8080);
        assert_eq!(info.participants.len(), 1);
        assert_eq!(info.participants[0].id, "u1");
        assert_eq!(info.document_ids, vec!["doc1.rs"]);
    }

    #[test]
    fn collab_message_join_room_serde() {
        let msg = CollabMessage::JoinRoom {
            session_id: "sess1".into(),
            user: make_participant("u1"),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\""));
        assert!(json.contains("\"payload\""));
        assert!(json.contains("\"join_room\""));
        let deserialized: CollabMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            CollabMessage::JoinRoom { session_id, user } => {
                assert_eq!(session_id, "sess1");
                assert_eq!(user.id, "u1");
            }
            _ => panic!("expected JoinRoom variant"),
        }
    }

    #[test]
    fn collab_message_leave_room_serde() {
        let msg = CollabMessage::LeaveRoom {
            session_id: "sess2".into(),
            user_id: "u2".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: CollabMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            CollabMessage::LeaveRoom {
                session_id,
                user_id,
            } => {
                assert_eq!(session_id, "sess2");
                assert_eq!(user_id, "u2");
            }
            _ => panic!("expected LeaveRoom variant"),
        }
    }

    #[test]
    fn collab_message_ping_pong_serde() {
        let ping_json = serde_json::to_string(&CollabMessage::Ping).unwrap();
        assert!(ping_json.contains("\"ping\""));
        let ping: CollabMessage = serde_json::from_str(&ping_json).unwrap();
        assert!(matches!(ping, CollabMessage::Ping));

        let pong_json = serde_json::to_string(&CollabMessage::Pong).unwrap();
        assert!(pong_json.contains("\"pong\""));
        let pong: CollabMessage = serde_json::from_str(&pong_json).unwrap();
        assert!(matches!(pong, CollabMessage::Pong));
    }

    #[test]
    fn collab_message_error_serde() {
        let msg = CollabMessage::Error {
            message: "something went wrong".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"error\""));
        let deserialized: CollabMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            CollabMessage::Error { message } => {
                assert_eq!(message, "something went wrong");
            }
            _ => panic!("expected Error variant"),
        }
    }

    #[test]
    fn collab_message_document_sync_serde() {
        let msg = CollabMessage::DocumentSync {
            file_id: "main.rs".into(),
            update: "base64data".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"document_sync\""));
        let deserialized: CollabMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            CollabMessage::DocumentSync { file_id, update } => {
                assert_eq!(file_id, "main.rs");
                assert_eq!(update, "base64data");
            }
            _ => panic!("expected DocumentSync variant"),
        }
    }

    #[test]
    fn collab_message_chat_message_serde() {
        let msg = CollabMessage::ChatMessage {
            id: "msg1".into(),
            user_id: "u1".into(),
            user_name: "Alice".into(),
            user_color: "#ff0000".into(),
            content: "Hello!".into(),
            timestamp: 12345,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"chat_message\""));
        let deserialized: CollabMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            CollabMessage::ChatMessage {
                id,
                user_id,
                user_name,
                user_color,
                content,
                timestamp,
            } => {
                assert_eq!(id, "msg1");
                assert_eq!(user_id, "u1");
                assert_eq!(user_name, "Alice");
                assert_eq!(user_color, "#ff0000");
                assert_eq!(content, "Hello!");
                assert_eq!(timestamp, 12345);
            }
            _ => panic!("expected ChatMessage variant"),
        }
    }

    #[test]
    fn awareness_entry_serde_roundtrip() {
        let entry_none = AwarenessEntry {
            user_id: "u1".into(),
            user_name: "Alice".into(),
            user_color: "#f97316".into(),
            cursor: None,
            selection: None,
            active_file: None,
            timestamp: 3000,
        };
        let json_none = serde_json::to_string(&entry_none).unwrap();
        assert!(json_none.contains("\"userId\""));
        assert!(json_none.contains("\"userName\""));
        assert!(json_none.contains("\"userColor\""));
        assert!(json_none.contains("\"activeFile\""));
        let de_none: AwarenessEntry = serde_json::from_str(&json_none).unwrap();
        assert!(de_none.cursor.is_none());
        assert!(de_none.selection.is_none());
        assert!(de_none.active_file.is_none());

        let entry_some = AwarenessEntry {
            user_id: "u2".into(),
            user_name: "Bob".into(),
            user_color: "#22c55e".into(),
            cursor: Some(make_cursor()),
            selection: Some(make_selection()),
            active_file: Some("lib.rs".into()),
            timestamp: 4000,
        };
        let json_some = serde_json::to_string(&entry_some).unwrap();
        let de_some: AwarenessEntry = serde_json::from_str(&json_some).unwrap();
        assert!(de_some.cursor.is_some());
        assert!(de_some.selection.is_some());
        assert_eq!(de_some.active_file.unwrap(), "lib.rs");
    }

    #[test]
    fn color_for_index_basic() {
        assert_eq!(color_for_index(0), USER_COLORS[0]);
    }

    #[test]
    fn color_for_index_wraps() {
        assert_eq!(color_for_index(10), color_for_index(0));
    }

    #[test]
    fn user_colors_count() {
        assert_eq!(USER_COLORS.len(), 10);
    }
}
