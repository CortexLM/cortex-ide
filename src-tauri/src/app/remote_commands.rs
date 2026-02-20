#[macro_export]
macro_rules! remote_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            // Remote development commands
            $crate::remote::commands::remote_connect,
            $crate::remote::commands::remote_disconnect,
            $crate::remote::commands::remote_get_status,
            $crate::remote::commands::remote_get_connections,
            $crate::remote::commands::remote_get_profiles,
            $crate::remote::commands::remote_save_profile,
            $crate::remote::commands::remote_delete_profile,
            $crate::remote::commands::remote_list_directory,
            $crate::remote::commands::remote_get_file_tree,
            $crate::remote::commands::remote_read_file,
            $crate::remote::commands::remote_write_file,
            $crate::remote::commands::remote_delete,
            $crate::remote::commands::remote_create_directory,
            $crate::remote::commands::remote_rename,
            $crate::remote::commands::remote_execute_command,
            $crate::remote::commands::remote_stat,
            $crate::remote::commands::remote_generate_profile_id,
            $crate::remote::commands::remote_get_default_key_paths,
            $crate::remote::commands::remote_connect_with_password,
            $crate::remote::commands::remote_connect_with_passphrase,
            $crate::remote::commands::remote_save_profile_with_credentials,
            $crate::remote::commands::remote_has_stored_password,
            $crate::remote::commands::remote_has_stored_passphrase,
            // Remote port forwarding commands
            $crate::remote::commands::remote_forward_port,
            $crate::remote::commands::remote_stop_forward,
            $crate::remote::commands::tunnel_close,
            // Remote tunnel commands
            $crate::remote::tunnel::remote_tunnel_create,
            $crate::remote::tunnel::remote_tunnel_connect,
            $crate::remote::tunnel::remote_tunnel_disconnect,
            $crate::remote::tunnel::remote_tunnel_status,
            $crate::remote::tunnel::remote_tunnel_list,
            // DevContainer commands
            $crate::remote::commands::devcontainer_connect,
            $crate::remote::commands::devcontainer_start,
            $crate::remote::commands::devcontainer_stop,
            $crate::remote::commands::devcontainer_remove,
            $crate::remote::commands::devcontainer_build,
            $crate::remote::commands::devcontainer_load_config,
            $crate::remote::commands::devcontainer_save_config,
            $crate::remote::commands::devcontainer_list_features,
            $crate::remote::commands::devcontainer_list_templates,
        ])
    };
}
