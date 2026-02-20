#[macro_export]
macro_rules! settings_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            // Settings commands
            $crate::settings::commands::settings_load,
            $crate::settings::commands::settings_save,
            $crate::settings::commands::settings_get,
            $crate::settings::commands::settings_update,
            $crate::settings::commands::settings_reset,
            $crate::settings::commands::settings_reset_section,
            $crate::settings::commands::settings_get_path,
            $crate::settings::commands::settings_export,
            $crate::settings::commands::settings_import,
            $crate::settings::commands::settings_get_extension,
            $crate::settings::commands::settings_set_extension,
            // Secure API key commands (keyring-based storage)
            $crate::settings::commands::settings_set_api_key,
            $crate::settings::commands::settings_get_api_key_exists,
            $crate::settings::commands::settings_delete_api_key,
            // Settings Sync commands
            $crate::settings_sync::commands::sync_push,
            $crate::settings_sync::commands::sync_pull,
            $crate::settings_sync::commands::sync_status,
            $crate::settings_sync::commands::sync_resolve_conflicts,
            // Profile management commands
            $crate::settings::profiles::profiles_save,
            $crate::settings::profiles::profiles_load,
            $crate::settings::profiles::profile_export,
            $crate::settings::profiles::profile_import,
            $crate::settings::profiles::profile_switch,
            $crate::settings::profiles::profile_set_default_for_workspace,
            $crate::settings::profiles::profile_get_default_for_workspace,
            $crate::settings::profiles::profile_list,
            // Theme management commands
            $crate::themes::load_theme_file,
            $crate::themes::list_available_themes,
            $crate::themes::get_theme_by_id,
            $crate::themes::export_theme,
            // Keybinding management commands
            $crate::keybindings::load_keybindings_file,
            $crate::keybindings::save_keybindings_file,
            $crate::keybindings::get_default_keybindings,
            $crate::keybindings::import_keybindings,
            $crate::keybindings::export_keybindings,
            $crate::keybindings::detect_conflicts,
        ])
    };
}
