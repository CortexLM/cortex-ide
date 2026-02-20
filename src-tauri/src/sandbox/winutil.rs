#![allow(unsafe_code)]
//! Windows utility functions for sandbox operations.

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;

/// Convert an OsStr to a null-terminated wide string (UTF-16).
pub fn to_wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}

/// Convert a &str to a null-terminated wide string (UTF-16).
pub fn str_to_wide(s: &str) -> Vec<u16> {
    to_wide(OsStr::new(s))
}

/// Quote command line arguments for Windows.
/// Handles spaces and quotes in arguments.
pub fn quote_args(args: &[String]) -> String {
    args.iter()
        .map(|arg| {
            if arg.contains(' ') || arg.contains('"') || arg.contains('\t') {
                // Escape internal quotes and wrap in quotes
                format!("\"{}\"", arg.replace('"', "\\\""))
            } else {
                arg.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Get the last Windows error as a formatted string.
pub fn get_last_error_string() -> String {
    // SAFETY: GetLastError is always safe to call
    let code = unsafe { windows_sys::Win32::Foundation::GetLastError() };
    format!("Windows error code: {}", code)
}

/// Get the last Windows error code.
pub fn get_last_error() -> u32 {
    // SAFETY: GetLastError is always safe to call
    unsafe { windows_sys::Win32::Foundation::GetLastError() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_wide() {
        let wide = str_to_wide("test");
        assert_eq!(wide, vec![116, 101, 115, 116, 0]); // "test" + null
    }

    #[test]
    fn test_quote_args_simple() {
        let args = vec!["cmd".to_string(), "/c".to_string(), "echo".to_string()];
        assert_eq!(quote_args(&args), "cmd /c echo");
    }

    #[test]
    fn test_quote_args_with_spaces() {
        let args = vec!["cmd".to_string(), "hello world".to_string()];
        assert_eq!(quote_args(&args), "cmd \"hello world\"");
    }
}
