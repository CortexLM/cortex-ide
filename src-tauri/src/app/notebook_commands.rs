#[macro_export]
macro_rules! notebook_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            // REPL commands
            $crate::app::repl_list_kernel_specs,
            $crate::app::repl_start_kernel,
            $crate::app::repl_list_kernels,
            $crate::app::repl_execute,
            $crate::app::repl_interrupt,
            $crate::app::repl_shutdown_kernel,
            $crate::app::repl_restart_kernel,
            $crate::app::repl_get_kernel,
            // Notebook kernel commands
            $crate::notebook::notebook_execute_cell,
            $crate::notebook::notebook_interrupt_kernel,
            $crate::notebook::notebook_shutdown_kernel,
            $crate::notebook::notebook_start_kernel,
            // Notebook file commands
            $crate::notebook::notebook_parse_ipynb,
            $crate::notebook::notebook_save_ipynb,
            $crate::notebook::notebook_export_html,
            $crate::notebook::notebook_export_python,
            $crate::notebook::notebook_list_kernels,
            $crate::notebook::notebook_export_pdf,
            $crate::notebook::notebook_detect_kernels,
            $crate::notebook::notebook_cell_split,
            $crate::notebook::notebook_cell_join,
            $crate::notebook::notebook_reorder_cells,
            $crate::notebook::notebook_install_kernel,
            $crate::notebook::notebook_restart_kernel,
            $crate::notebook::notebook_kernel_status,
        ])
    };
}
