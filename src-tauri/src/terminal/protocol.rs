//! OSC 633 shell integration protocol parsing
//!
//! Parses VS Code-style shell integration sequences (OSC 633) to track
//! command boundaries, working directory, and other shell state.

use serde::{Deserialize, Serialize};

/// Shell integration events derived from OSC 633 sequences
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ShellIntegrationEvent {
    PromptStart,
    CommandStart,
    CommandExecuted { command_line: Option<String> },
    CommandFinished { exit_code: Option<i32> },
    SetCwd { cwd: String },
    SetMark,
}

/// Accumulated shell integration state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ShellIntegrationState {
    pub cwd: Option<String>,
    pub last_command: Option<String>,
    pub last_exit_code: Option<i32>,
    pub in_command: bool,
}

/// Parse OSC 633 sequences from a text buffer.
///
/// OSC 633 format: `\x1b]633;PARAM\x07` or `\x1b]633;PARAM\x1b\\`
/// Params:
///   A - Prompt start
///   B - Command start
///   C - Command executed
///   D;exitcode - Command finished
///   E;commandline - Command line (with C)
///   P;Cwd=path - Set working directory
///   SetMark - Set a mark
pub fn parse_osc_633(text: &str) -> Vec<ShellIntegrationEvent> {
    let mut events = Vec::new();
    let mut pos = 0;
    let bytes = text.as_bytes();

    while pos < bytes.len() {
        if bytes[pos] == 0x1b && pos + 1 < bytes.len() && bytes[pos + 1] == b']' {
            if let Some(osc_start) = text.get(pos + 2..) {
                if osc_start.starts_with("633;") {
                    let content_start = pos + 6;
                    let end_st = text[content_start..].find('\x07');
                    let end_esc = text[content_start..].find("\x1b\\");
                    let end_pos = match (end_st, end_esc) {
                        (Some(a), Some(b)) => Some(a.min(b)),
                        (Some(a), None) => Some(a),
                        (None, Some(b)) => Some(b),
                        (None, None) => None,
                    };

                    if let Some(end) = end_pos {
                        let content = &text[content_start..content_start + end];
                        if let Some(event) = parse_osc_633_content(content) {
                            events.push(event);
                        }
                        pos = content_start + end + 1;
                        continue;
                    }
                }
            }
        }
        pos += 1;
    }

    events
}

fn parse_osc_633_content(content: &str) -> Option<ShellIntegrationEvent> {
    let parts: Vec<&str> = content.splitn(2, ';').collect();
    match parts[0] {
        "A" => Some(ShellIntegrationEvent::PromptStart),
        "B" => Some(ShellIntegrationEvent::CommandStart),
        "C" => Some(ShellIntegrationEvent::CommandExecuted { command_line: None }),
        "D" => {
            let exit_code = parts.get(1).and_then(|s| s.parse::<i32>().ok());
            Some(ShellIntegrationEvent::CommandFinished { exit_code })
        }
        "E" => Some(ShellIntegrationEvent::CommandExecuted {
            command_line: parts.get(1).map(|s| s.to_string()),
        }),
        "P" => {
            if let Some(param) = parts.get(1) {
                if let Some(cwd) = param.strip_prefix("Cwd=") {
                    return Some(ShellIntegrationEvent::SetCwd {
                        cwd: cwd.to_string(),
                    });
                }
            }
            None
        }
        "SetMark" => Some(ShellIntegrationEvent::SetMark),
        _ => None,
    }
}

/// Strip OSC 633 sequences from text, returning clean output
pub fn strip_osc_633(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut pos = 0;
    let bytes = text.as_bytes();

    while pos < bytes.len() {
        if bytes[pos] == 0x1b && pos + 1 < bytes.len() && bytes[pos + 1] == b']' {
            if let Some(osc_start) = text.get(pos + 2..) {
                if osc_start.starts_with("633;") {
                    let content_start = pos + 6;
                    let end_st = text[content_start..].find('\x07');
                    let end_esc = text[content_start..].find("\x1b\\");
                    let skip_to = match (end_st, end_esc) {
                        (Some(a), Some(b)) => {
                            let min = a.min(b);
                            if min == b {
                                Some(content_start + min + 2)
                            } else {
                                Some(content_start + min + 1)
                            }
                        }
                        (Some(a), None) => Some(content_start + a + 1),
                        (None, Some(b)) => Some(content_start + b + 2),
                        (None, None) => None,
                    };

                    if let Some(new_pos) = skip_to {
                        pos = new_pos;
                        continue;
                    }
                }
            }
        }

        if let Some(ch) = text[pos..].chars().next() {
            result.push(ch);
            pos += ch.len_utf8();
        } else {
            pos += 1;
        }
    }

    result
}

/// Update shell integration state from events
pub fn update_state(state: &mut ShellIntegrationState, events: &[ShellIntegrationEvent]) {
    for event in events {
        match event {
            ShellIntegrationEvent::PromptStart => {
                state.in_command = false;
            }
            ShellIntegrationEvent::CommandStart => {
                state.in_command = true;
            }
            ShellIntegrationEvent::CommandExecuted { command_line } => {
                if let Some(cmd) = command_line {
                    state.last_command = Some(cmd.clone());
                }
                state.in_command = true;
            }
            ShellIntegrationEvent::CommandFinished { exit_code } => {
                state.last_exit_code = *exit_code;
                state.in_command = false;
            }
            ShellIntegrationEvent::SetCwd { cwd } => {
                state.cwd = Some(cwd.clone());
            }
            ShellIntegrationEvent::SetMark => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_prompt_start() {
        let text = "\x1b]633;A\x07";
        let events = parse_osc_633(text);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0], ShellIntegrationEvent::PromptStart);
    }

    #[test]
    fn test_parse_command_finished_with_exit_code() {
        let text = "\x1b]633;D;0\x07";
        let events = parse_osc_633(text);
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0],
            ShellIntegrationEvent::CommandFinished { exit_code: Some(0) }
        );
    }

    #[test]
    fn test_parse_command_line() {
        let text = "\x1b]633;E;ls -la\x07";
        let events = parse_osc_633(text);
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0],
            ShellIntegrationEvent::CommandExecuted {
                command_line: Some("ls -la".to_string())
            }
        );
    }

    #[test]
    fn test_parse_set_cwd() {
        let text = "\x1b]633;P;Cwd=/home/user\x07";
        let events = parse_osc_633(text);
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0],
            ShellIntegrationEvent::SetCwd {
                cwd: "/home/user".to_string()
            }
        );
    }

    #[test]
    fn test_strip_osc_633() {
        let text = "hello\x1b]633;A\x07world";
        let stripped = strip_osc_633(text);
        assert_eq!(stripped, "helloworld");
    }

    #[test]
    fn test_multiple_events() {
        let text = "\x1b]633;A\x07$ ls\x1b]633;B\x07\x1b]633;E;ls\x07output\x1b]633;D;0\x07";
        let events = parse_osc_633(text);
        assert_eq!(events.len(), 4);
    }

    #[test]
    fn test_update_state() {
        let mut state = ShellIntegrationState::default();
        let events = vec![
            ShellIntegrationEvent::SetCwd {
                cwd: "/home".to_string(),
            },
            ShellIntegrationEvent::CommandExecuted {
                command_line: Some("ls".to_string()),
            },
            ShellIntegrationEvent::CommandFinished { exit_code: Some(0) },
        ];
        update_state(&mut state, &events);
        assert_eq!(state.cwd, Some("/home".to_string()));
        assert_eq!(state.last_command, Some("ls".to_string()));
        assert_eq!(state.last_exit_code, Some(0));
        assert!(!state.in_command);
    }

    #[test]
    fn test_no_osc_sequences() {
        let events = parse_osc_633("just regular text");
        assert!(events.is_empty());
    }
}
