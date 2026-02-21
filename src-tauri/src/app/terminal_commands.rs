#[cfg(feature = "remote-ssh")]
#[macro_export]
macro_rules! terminal_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            // Terminal PTY commands
            $crate::terminal::commands::terminal_create,
            $crate::terminal::commands::terminal_write,
            $crate::terminal::commands::terminal_update,
            $crate::terminal::commands::terminal_resize,
            $crate::terminal::commands::terminal_close,
            $crate::terminal::commands::terminal_list,
            $crate::terminal::commands::terminal_get,
            $crate::terminal::commands::terminal_send_interrupt,
            $crate::terminal::commands::terminal_send_eof,
            $crate::terminal::commands::terminal_ack,
            $crate::terminal::commands::terminal_close_all,
            $crate::terminal::commands::terminal_get_default_shell,
            // Port management commands
            $crate::terminal::commands::get_process_on_port,
            $crate::terminal::commands::kill_process_on_port,
            $crate::terminal::commands::list_listening_ports,
            // Shell detection commands
            $crate::terminal::commands::terminal_detect_shells,
            $crate::terminal::commands::path_exists,
            $crate::terminal::commands::terminal_detect_links,
            $crate::terminal::commands::terminal_search,
            $crate::terminal::commands::terminal_parse_shell_integration,
            $crate::terminal::commands::terminal_strip_sequences,
            // Terminal profiles commands
            $crate::terminal::profiles::terminal_profiles_list,
            $crate::terminal::profiles::terminal_profiles_save,
            $crate::terminal::profiles::terminal_profiles_delete,
            $crate::terminal::profiles::terminal_profiles_get,
            $crate::terminal::profiles::terminal_profiles_set_default,
            // SSH Terminal PTY commands
            $crate::ssh_terminal::ssh_connect,
            $crate::ssh_terminal::ssh_pty_write,
            $crate::ssh_terminal::ssh_pty_resize,
            $crate::ssh_terminal::ssh_pty_ack,
            $crate::ssh_terminal::ssh_disconnect,
            $crate::ssh_terminal::ssh_get_session,
            $crate::ssh_terminal::ssh_list_sessions,
            $crate::ssh_terminal::ssh_exec,
            $crate::ssh_terminal::ssh_close_all,
            // SSH profile management commands
            $crate::ssh_terminal::ssh_save_profile,
            $crate::ssh_terminal::ssh_delete_profile,
            $crate::ssh_terminal::ssh_generate_profile_id,
            $crate::ssh_terminal::ssh_list_profiles,
        ])
    };
}

#[cfg(not(feature = "remote-ssh"))]
#[macro_export]
macro_rules! terminal_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            // Terminal PTY commands
            $crate::terminal::commands::terminal_create,
            $crate::terminal::commands::terminal_write,
            $crate::terminal::commands::terminal_update,
            $crate::terminal::commands::terminal_resize,
            $crate::terminal::commands::terminal_close,
            $crate::terminal::commands::terminal_list,
            $crate::terminal::commands::terminal_get,
            $crate::terminal::commands::terminal_send_interrupt,
            $crate::terminal::commands::terminal_send_eof,
            $crate::terminal::commands::terminal_ack,
            $crate::terminal::commands::terminal_close_all,
            $crate::terminal::commands::terminal_get_default_shell,
            // Port management commands
            $crate::terminal::commands::get_process_on_port,
            $crate::terminal::commands::kill_process_on_port,
            $crate::terminal::commands::list_listening_ports,
            // Shell detection commands
            $crate::terminal::commands::terminal_detect_shells,
            $crate::terminal::commands::path_exists,
            $crate::terminal::commands::terminal_detect_links,
            $crate::terminal::commands::terminal_search,
            $crate::terminal::commands::terminal_parse_shell_integration,
            $crate::terminal::commands::terminal_strip_sequences,
            // Terminal profiles commands
            $crate::terminal::profiles::terminal_profiles_list,
            $crate::terminal::profiles::terminal_profiles_save,
            $crate::terminal::profiles::terminal_profiles_delete,
            $crate::terminal::profiles::terminal_profiles_get,
            $crate::terminal::profiles::terminal_profiles_set_default,
        ])
    };
}
