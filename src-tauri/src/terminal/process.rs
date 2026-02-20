//! Process management utilities for terminals
//!
//! Provides functions for killing processes and process trees,
//! used when closing terminals and managing port conflicts.

/// Kill a process and all its child processes (process tree)
/// This is important for terminals as the shell may spawn child processes
pub fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Use taskkill with /T to kill process tree
        let output = crate::process_utils::command("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to run taskkill: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            // Taskkill may fail if process already exited, which is OK
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("not found") || stderr.contains("ERROR: The process") {
                Ok(()) // Process already gone
            } else {
                Err(format!("Failed to kill process tree: {}", stderr))
            }
        }
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        // On Unix, send SIGTERM to the process group (negative PID)
        // This requires the shell to be a process group leader
        // First try SIGTERM to the process group
        let pgid = pid.to_string();

        // Try to kill the process group first (will kill all children)
        let _ = crate::process_utils::command("kill")
            .args(["-TERM", "-", &pgid])
            .output();

        // Also kill the process directly
        let _ = crate::process_utils::command("kill")
            .args(["-TERM", &pgid])
            .output();

        // Wait briefly for processes to terminate
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Force kill if still running
        let _ = crate::process_utils::command("kill")
            .args(["-KILL", "-", &pgid])
            .output();
        let _ = crate::process_utils::command("kill")
            .args(["-KILL", &pgid])
            .output();

        Ok(())
    }
}

/// Kill a process by PID
pub fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = crate::process_utils::command("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to run taskkill: {}", e))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to kill process: {}", stderr))
        }
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        // Try SIGTERM first
        let output = crate::process_utils::command("kill")
            .args(["-15", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to run kill: {}", e))?;

        if output.status.success() {
            // Wait a moment and check if process is still running
            std::thread::sleep(std::time::Duration::from_millis(500));

            // Check if process still exists
            let check = crate::process_utils::command("kill")
                .args(["-0", &pid.to_string()])
                .output();

            if let Ok(out) = check {
                if out.status.success() {
                    // Process still running, use SIGKILL
                    let _ = crate::process_utils::command("kill")
                        .args(["-9", &pid.to_string()])
                        .output();
                }
            }

            Ok(())
        } else {
            // Try SIGKILL as fallback
            let output = crate::process_utils::command("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .map_err(|e| format!("Failed to run kill -9: {}", e))?;

            if output.status.success() {
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Failed to kill process: {}", stderr))
            }
        }
    }
}

/// Get process information for a specific port (platform-specific implementation)
#[cfg(target_os = "windows")]
pub fn get_process_on_port_impl(port: u16) -> Result<Option<super::types::PortProcess>, String> {
    use super::types::PortProcess;

    // Use netstat to find the process
    let output = crate::process_utils::command("netstat")
        .args(["-ano", "-p", "TCP"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains(&format!(":{}", port))
            && (line.contains("LISTENING") || line.contains("ESTABLISHED"))
        {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let local_addr = parts[1];
                // Check if this is the port we're looking for
                if let Some(port_str) = local_addr.split(':').last() {
                    if port_str.parse::<u16>().unwrap_or(0) == port {
                        let pid: u32 = parts[4].parse().unwrap_or(0);
                        if pid == 0 {
                            continue;
                        }

                        let (process_name, command, user) = get_process_info_windows(pid);

                        return Ok(Some(PortProcess {
                            port,
                            pid,
                            process_name,
                            command,
                            user,
                            protocol: "tcp".to_string(),
                            local_address: Some(local_addr.to_string()),
                            state: parts.get(3).map(|s| s.to_string()),
                        }));
                    }
                }
            }
        }
    }

    // Also check UDP
    let output = crate::process_utils::command("netstat")
        .args(["-ano", "-p", "UDP"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains(&format!(":{}", port)) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let local_addr = parts[1];
                if let Some(port_str) = local_addr.split(':').last() {
                    if port_str.parse::<u16>().unwrap_or(0) == port {
                        let pid: u32 = parts[3].parse().unwrap_or(0);
                        if pid == 0 {
                            continue;
                        }

                        let (process_name, command, user) = get_process_info_windows(pid);

                        return Ok(Some(PortProcess {
                            port,
                            pid,
                            process_name,
                            command,
                            user,
                            protocol: "udp".to_string(),
                            local_address: Some(local_addr.to_string()),
                            state: None,
                        }));
                    }
                }
            }
        }
    }

    Ok(None)
}

#[cfg(target_os = "windows")]
fn get_process_info_windows(pid: u32) -> (String, String, String) {
    // Get process name using tasklist
    let output = crate::process_utils::command("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .output();

    let (process_name, command) = match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let line = stdout.lines().next().unwrap_or("");
            let parts: Vec<&str> = line.split(',').collect();
            if !parts.is_empty() {
                let name = parts[0].trim_matches('"').to_string();
                (name.clone(), name)
            } else {
                ("Unknown".to_string(), "Unknown".to_string())
            }
        }
        Err(_) => ("Unknown".to_string(), "Unknown".to_string()),
    };

    // Try to get command line using wmic
    let cmd_output = crate::process_utils::command("wmic")
        .args([
            "process",
            "where",
            &format!("ProcessId={}", pid),
            "get",
            "CommandLine",
            "/VALUE",
        ])
        .output();

    let full_command = match cmd_output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout
                .lines()
                .find(|l| l.starts_with("CommandLine="))
                .map(|l| l.trim_start_matches("CommandLine=").to_string())
                .unwrap_or_else(|| command.clone())
        }
        Err(_) => command.clone(),
    };

    (
        process_name,
        full_command,
        std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".to_string()),
    )
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
pub fn get_process_on_port_impl(port: u16) -> Result<Option<super::types::PortProcess>, String> {
    use super::types::PortProcess;

    // Use lsof to find the process
    let output = crate::process_utils::command("lsof")
        .args(["-i", &format!(":{}", port), "-P", "-n"])
        .output()
        .map_err(|e| format!("Failed to run lsof: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Skip header line
    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 9 {
            let process_name = parts[0].to_string();
            let pid: u32 = parts[1].parse().unwrap_or(0);
            let user = parts[2].to_string();
            let protocol = parts[7].to_lowercase();
            let local_addr = parts[8].to_string();

            // Parse state from the connection info
            let state = if parts.len() > 9 {
                Some(
                    parts[9]
                        .trim_start_matches('(')
                        .trim_end_matches(')')
                        .to_string(),
                )
            } else {
                None
            };

            // Get full command line
            let cmd_output = crate::process_utils::command("ps")
                .args(["-p", &pid.to_string(), "-o", "command="])
                .output();

            let command = match cmd_output {
                Ok(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
                Err(_) => process_name.clone(),
            };

            return Ok(Some(PortProcess {
                port,
                pid,
                process_name,
                command,
                user,
                protocol,
                local_address: Some(local_addr),
                state,
            }));
        }
    }

    Ok(None)
}

/// List all listening ports (platform-specific implementation)
#[cfg(target_os = "windows")]
pub fn list_listening_ports_impl() -> Result<Vec<super::types::PortProcess>, String> {
    use super::types::PortProcess;
    use std::collections::HashMap;

    let mut processes: Vec<PortProcess> = Vec::new();
    let mut seen_ports: HashMap<u16, bool> = HashMap::new();

    // TCP listening ports
    let output = crate::process_utils::command("netstat")
        .args(["-ano", "-p", "TCP"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains("LISTENING") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let local_addr = parts[1];
                if let Some(port_str) = local_addr.split(':').last() {
                    if let Ok(port) = port_str.parse::<u16>() {
                        if seen_ports.contains_key(&port) {
                            continue;
                        }
                        seen_ports.insert(port, true);

                        let pid: u32 = parts[4].parse().unwrap_or(0);
                        if pid == 0 {
                            continue;
                        }

                        let (process_name, command, user) = get_process_info_windows(pid);

                        processes.push(PortProcess {
                            port,
                            pid,
                            process_name,
                            command,
                            user,
                            protocol: "tcp".to_string(),
                            local_address: Some(local_addr.to_string()),
                            state: Some("LISTENING".to_string()),
                        });
                    }
                }
            }
        }
    }

    // Sort by port number
    processes.sort_by(|a, b| a.port.cmp(&b.port));

    Ok(processes)
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
pub fn list_listening_ports_impl() -> Result<Vec<super::types::PortProcess>, String> {
    use super::types::PortProcess;
    use std::collections::HashMap;

    let mut processes: Vec<PortProcess> = Vec::new();
    let mut seen_ports: HashMap<u16, bool> = HashMap::new();

    // Use lsof to list all listening ports
    let output = crate::process_utils::command("lsof")
        .args(["-i", "-P", "-n", "-sTCP:LISTEN"])
        .output()
        .map_err(|e| format!("Failed to run lsof: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Skip header line
    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 9 {
            let process_name = parts[0].to_string();
            let pid: u32 = parts[1].parse().unwrap_or(0);
            let user = parts[2].to_string();
            let protocol = parts[7].to_lowercase();
            let local_addr = parts[8].to_string();

            // Extract port from address (e.g., "*:3000" or "127.0.0.1:8080")
            let port = if let Some(port_str) = local_addr.split(':').next_back() {
                port_str.parse::<u16>().unwrap_or(0)
            } else {
                continue;
            };

            if port == 0 || seen_ports.contains_key(&port) {
                continue;
            }
            seen_ports.insert(port, true);

            // Get full command line
            let cmd_output = crate::process_utils::command("ps")
                .args(["-p", &pid.to_string(), "-o", "command="])
                .output();

            let command = match cmd_output {
                Ok(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
                Err(_) => process_name.clone(),
            };

            processes.push(PortProcess {
                port,
                pid,
                process_name,
                command,
                user,
                protocol,
                local_address: Some(local_addr),
                state: Some("LISTEN".to_string()),
            });
        }
    }

    // Sort by port number
    processes.sort_by(|a, b| a.port.cmp(&b.port));

    Ok(processes)
}
