//! Session Tokens and Room Management
//!
//! Manages collaboration rooms, user sessions, and invite tokens.
//! Provides room lifecycle operations and access control.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Permission level for a room participant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Permission {
    Owner,
    Editor,
    Viewer,
}

/// A participant in a collaboration room.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub permission: Permission,
    pub joined_at: u64,
}

/// An invite token for joining a room.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteToken {
    pub token: String,
    pub room_id: String,
    pub permission: Permission,
    pub expires_at: Option<u64>,
    pub max_uses: Option<u32>,
    pub used_count: u32,
    pub created_at: u64,
}

/// A collaboration room.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub host_id: String,
    pub participants: Vec<Participant>,
    pub shared_files: Vec<String>,
    pub default_permission: Permission,
    pub created_at: u64,
    pub invite_tokens: Vec<InviteToken>,
}

/// Information returned to the frontend about a room.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub id: String,
    pub name: String,
    pub host_id: String,
    pub participant_count: usize,
    pub created_at: u64,
}

/// Information about a participant returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub permission: Permission,
    pub joined_at: u64,
}

/// User colors for remote cursors — vibrant and distinguishable.
const USER_COLORS: &[&str] = &[
    "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
    "#06b6d4", "#8b5cf6",
];

/// Manages all collaboration rooms.
pub struct RoomManager {
    rooms: HashMap<String, Room>,
    user_sessions: HashMap<String, String>, // session_token -> user_id
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
            user_sessions: HashMap::new(),
        }
    }

    /// Create a new collaboration room.
    pub fn create_room(&mut self, name: &str, user_id: &str, user_name: &str) -> Room {
        let room_id = uuid::Uuid::new_v4().to_string();
        let now = current_timestamp();

        let host = Participant {
            user_id: user_id.to_string(),
            name: user_name.to_string(),
            color: USER_COLORS[0].to_string(),
            permission: Permission::Owner,
            joined_at: now,
        };

        let room = Room {
            id: room_id.clone(),
            name: name.to_string(),
            host_id: user_id.to_string(),
            participants: vec![host],
            shared_files: Vec::new(),
            default_permission: Permission::Editor,
            created_at: now,
            invite_tokens: Vec::new(),
        };

        self.rooms.insert(room_id, room.clone());
        room
    }

    /// Join an existing room.
    pub fn join_room(
        &mut self,
        room_id: &str,
        user_id: &str,
        user_name: &str,
    ) -> Result<Room, String> {
        let room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        if room.participants.iter().any(|p| p.user_id == user_id) {
            return Ok(room.clone());
        }

        let color_index = room.participants.len() % USER_COLORS.len();
        let participant = Participant {
            user_id: user_id.to_string(),
            name: user_name.to_string(),
            color: USER_COLORS[color_index].to_string(),
            permission: room.default_permission.clone(),
            joined_at: current_timestamp(),
        };

        room.participants.push(participant);
        Ok(room.clone())
    }

    /// Join a room using an invite token.
    pub fn join_room_with_token(
        &mut self,
        token: &str,
        user_id: &str,
        user_name: &str,
    ) -> Result<Room, String> {
        let (room_id, permission) = {
            let mut found = None;
            for room in self.rooms.values_mut() {
                if let Some(invite) = room.invite_tokens.iter_mut().find(|t| t.token == token) {
                    if let Some(expires) = invite.expires_at {
                        if current_timestamp() > expires {
                            return Err("Invite token has expired".to_string());
                        }
                    }
                    if let Some(max) = invite.max_uses {
                        if invite.used_count >= max {
                            return Err("Invite token has reached maximum uses".to_string());
                        }
                    }
                    invite.used_count += 1;
                    found = Some((room.id.clone(), invite.permission.clone()));
                    break;
                }
            }
            found.ok_or_else(|| "Invalid invite token".to_string())?
        };

        let room = self
            .rooms
            .get_mut(&room_id)
            .ok_or_else(|| "Room not found after join".to_string())?;

        if room.participants.iter().any(|p| p.user_id == user_id) {
            return Ok(room.clone());
        }

        let color_index = room.participants.len() % USER_COLORS.len();
        let participant = Participant {
            user_id: user_id.to_string(),
            name: user_name.to_string(),
            color: USER_COLORS[color_index].to_string(),
            permission,
            joined_at: current_timestamp(),
        };

        room.participants.push(participant);
        Ok(room.clone())
    }

    /// Remove a user from a room.
    pub fn leave_room(&mut self, room_id: &str, user_id: &str) -> Result<(), String> {
        let room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        room.participants.retain(|p| p.user_id != user_id);

        if room.participants.is_empty() {
            self.rooms.remove(room_id);
        }

        Ok(())
    }

    /// Get a room by ID.
    pub fn get_room(&self, room_id: &str) -> Option<&Room> {
        self.rooms.get(room_id)
    }

    /// Get participants of a room.
    pub fn get_participants(&self, room_id: &str) -> Result<Vec<ParticipantInfo>, String> {
        let room = self
            .rooms
            .get(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        Ok(room
            .participants
            .iter()
            .map(|p| ParticipantInfo {
                user_id: p.user_id.clone(),
                name: p.name.clone(),
                color: p.color.clone(),
                permission: p.permission.clone(),
                joined_at: p.joined_at,
            })
            .collect())
    }

    /// Generate an invite token for a room.
    pub fn generate_invite_token(
        &mut self,
        room_id: &str,
        permission: Permission,
        expires_in_ms: Option<u64>,
        max_uses: Option<u32>,
    ) -> Result<String, String> {
        let room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        let token = uuid::Uuid::new_v4().to_string();
        let now = current_timestamp();

        let invite = InviteToken {
            token: token.clone(),
            room_id: room_id.to_string(),
            permission,
            expires_at: expires_in_ms.map(|ms| now + ms),
            max_uses,
            used_count: 0,
            created_at: now,
        };

        room.invite_tokens.push(invite);
        Ok(token)
    }

    /// Revoke an invite token.
    pub fn revoke_invite_token(&mut self, room_id: &str, token: &str) -> Result<(), String> {
        let room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        room.invite_tokens.retain(|t| t.token != token);
        Ok(())
    }

    /// Create a session token for a user.
    pub fn create_session(&mut self, user_id: &str) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        self.user_sessions
            .insert(token.clone(), user_id.to_string());
        token
    }

    /// Validate a session token and return the user ID.
    pub fn validate_session(&self, token: &str) -> Option<&String> {
        self.user_sessions.get(token)
    }

    /// Remove a session token.
    pub fn remove_session(&mut self, token: &str) {
        self.user_sessions.remove(token);
    }

    /// Update a participant's permission.
    pub fn update_permission(
        &mut self,
        room_id: &str,
        user_id: &str,
        permission: Permission,
    ) -> Result<(), String> {
        let room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| format!("Room not found: {}", room_id))?;

        let participant = room
            .participants
            .iter_mut()
            .find(|p| p.user_id == user_id)
            .ok_or_else(|| format!("Participant not found: {}", user_id))?;

        participant.permission = permission;
        Ok(())
    }

    /// Get room info (lightweight summary).
    pub fn get_room_info(&self, room_id: &str) -> Option<RoomInfo> {
        self.rooms.get(room_id).map(|room| RoomInfo {
            id: room.id.clone(),
            name: room.name.clone(),
            host_id: room.host_id.clone(),
            participant_count: room.participants.len(),
            created_at: room.created_at,
        })
    }

    /// List all active rooms.
    pub fn list_rooms(&self) -> Vec<RoomInfo> {
        self.rooms
            .values()
            .map(|room| RoomInfo {
                id: room.id.clone(),
                name: room.name.clone(),
                host_id: room.host_id.clone(),
                participant_count: room.participants.len(),
                created_at: room.created_at,
            })
            .collect()
    }
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}