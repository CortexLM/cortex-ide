//! Editor feature module for Cortex Desktop
//!
//! Provides editor-level features that complement LSP functionality:
//! - Folding range computation, breadcrumb navigation, and sticky scroll
//! - Workspace symbol indexing with parallel search
//! - Snippet parsing and expansion
//! - Refactoring operations (rename, extract variable/method)
//! - Inline diff computation

pub mod folding;
pub mod inline_diff;
pub mod refactoring;
pub mod snippets;
pub mod symbols;
