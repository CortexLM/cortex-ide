//! Integration test: verify the IPC command macro chain compiles and links.
//!
//! The `cortex_commands!` macro expands into `$crate::` paths that reference
//! private modules, so it can only be invoked from inside the crate.  This
//! integration test therefore validates the public re-export of the `run`
//! function (which transitively depends on the macro chain) and confirms the
//! library crate links correctly.

#[test]
fn lib_crate_links_and_exports_run() {
    let _run_fn: fn() = cortex_gui_lib::run;
}
