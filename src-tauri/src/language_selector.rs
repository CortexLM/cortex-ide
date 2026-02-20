//! Language detection and selector functionality for Cortex Desktop.
//!
//! This module provides Tauri commands for language detection based on file paths,
//! extensions, and content analysis.

use std::collections::HashMap;
use std::path::Path;

/// Language information structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LanguageInfo {
    pub id: String,
    pub name: String,
    pub extensions: Vec<String>,
}

/// Language detection result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectionResult {
    pub language_id: String,
    pub confidence: f32,
    pub method: String,
}

/// Get all supported Monaco editor languages
fn get_language_registry() -> HashMap<&'static str, (&'static str, &'static [&'static str])> {
    let mut registry = HashMap::new();

    // Web Languages
    registry.insert("html", ("HTML", &[".html", ".htm", ".xhtml", ".shtml"][..]));
    registry.insert("css", ("CSS", &[".css"][..]));
    registry.insert("scss", ("SCSS", &[".scss"][..]));
    registry.insert("less", ("Less", &[".less"][..]));
    registry.insert(
        "javascript",
        ("JavaScript", &[".js", ".mjs", ".cjs", ".es6"][..]),
    );
    registry.insert("typescript", ("TypeScript", &[".ts", ".mts", ".cts"][..]));
    registry.insert("jsx", ("JavaScript React", &[".jsx"][..]));
    registry.insert("tsx", ("TypeScript React", &[".tsx"][..]));
    registry.insert("vue", ("Vue", &[".vue"][..]));
    registry.insert("svelte", ("Svelte", &[".svelte"][..]));
    registry.insert("astro", ("Astro", &[".astro"][..]));
    registry.insert("php", ("PHP", &[".php", ".phtml"][..]));

    // Systems Languages
    registry.insert("c", ("C", &[".c", ".h"][..]));
    registry.insert(
        "cpp",
        ("C++", &[".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"][..]),
    );
    registry.insert("rust", ("Rust", &[".rs"][..]));
    registry.insert("go", ("Go", &[".go"][..]));
    registry.insert("swift", ("Swift", &[".swift"][..]));
    registry.insert("objective-c", ("Objective-C", &[".m", ".mm"][..]));
    registry.insert("java", ("Java", &[".java"][..]));
    registry.insert("kotlin", ("Kotlin", &[".kt", ".kts"][..]));
    registry.insert("csharp", ("C#", &[".cs"][..]));
    registry.insert("fsharp", ("F#", &[".fs", ".fsi", ".fsx"][..]));
    registry.insert("scala", ("Scala", &[".scala", ".sc"][..]));

    // Scripting Languages
    registry.insert("python", ("Python", &[".py", ".pyw", ".pyi", ".pyx"][..]));
    registry.insert("ruby", ("Ruby", &[".rb", ".rake", ".gemspec"][..]));
    registry.insert("perl", ("Perl", &[".pl", ".pm"][..]));
    registry.insert("lua", ("Lua", &[".lua"][..]));
    registry.insert(
        "shell",
        ("Shell Script", &[".sh", ".bash", ".zsh", ".fish"][..]),
    );
    registry.insert(
        "powershell",
        ("PowerShell", &[".ps1", ".psm1", ".psd1"][..]),
    );
    registry.insert("bat", ("Batch", &[".bat", ".cmd"][..]));

    // Data & Config
    registry.insert(
        "json",
        ("JSON", &[".json", ".bowerrc", ".jshintrc", ".jscsrc"][..]),
    );
    registry.insert("jsonc", ("JSON with Comments", &[".jsonc"][..]));
    registry.insert("yaml", ("YAML", &[".yaml", ".yml"][..]));
    registry.insert("toml", ("TOML", &[".toml"][..]));
    registry.insert(
        "xml",
        ("XML", &[".xml", ".xsd", ".xsl", ".xslt", ".svg"][..]),
    );
    registry.insert("ini", ("Ini", &[".ini", ".properties"][..]));
    registry.insert("sql", ("SQL", &[".sql"][..]));
    registry.insert("graphql", ("GraphQL", &[".graphql", ".gql"][..]));

    // Markup
    registry.insert(
        "markdown",
        ("Markdown", &[".md", ".markdown", ".mdown"][..]),
    );
    registry.insert("mdx", ("MDX", &[".mdx"][..]));
    registry.insert("restructuredtext", ("reStructuredText", &[".rst"][..]));

    // Other
    registry.insert("dockerfile", ("Dockerfile", &[][..]));
    registry.insert("plaintext", ("Plain Text", &[".txt"][..]));
    registry.insert("r", ("R", &[".r", ".R"][..]));
    registry.insert("julia", ("Julia", &[".jl"][..]));
    registry.insert("clojure", ("Clojure", &[".clj", ".cljs", ".cljc"][..]));
    registry.insert("elixir", ("Elixir", &[".ex", ".exs"][..]));
    registry.insert("haskell", ("Haskell", &[".hs", ".lhs"][..]));
    registry.insert("erlang", ("Erlang", &[".erl", ".hrl"][..]));
    registry.insert("dart", ("Dart", &[".dart"][..]));
    registry.insert("coffeescript", ("CoffeeScript", &[".coffee"][..]));
    registry.insert("sol", ("Solidity", &[".sol"][..]));

    registry
}

/// Map of special filenames to their language IDs
fn get_filename_mappings() -> HashMap<&'static str, &'static str> {
    let mut mappings = HashMap::new();

    // Dockerfiles
    mappings.insert("dockerfile", "dockerfile");
    mappings.insert("containerfile", "dockerfile");

    // Makefiles
    mappings.insert("makefile", "shell");
    mappings.insert("gnumakefile", "shell");

    // Ruby files
    mappings.insert("gemfile", "ruby");
    mappings.insert("rakefile", "ruby");
    mappings.insert("vagrantfile", "ruby");
    mappings.insert("podfile", "ruby");

    // Config files
    mappings.insert(".gitignore", "ini");
    mappings.insert(".gitattributes", "ini");
    mappings.insert(".editorconfig", "ini");
    mappings.insert(".dockerignore", "ini");
    mappings.insert(".npmrc", "ini");
    mappings.insert(".yarnrc", "yaml");

    // Package managers
    mappings.insert("package.json", "json");
    mappings.insert("package-lock.json", "json");
    mappings.insert("tsconfig.json", "jsonc");
    mappings.insert("jsconfig.json", "jsonc");

    // Cargo
    mappings.insert("cargo.toml", "toml");
    mappings.insert("cargo.lock", "toml");

    // Python
    mappings.insert("pyproject.toml", "toml");
    mappings.insert("poetry.lock", "toml");
    mappings.insert("requirements.txt", "plaintext");

    // Go
    mappings.insert("go.mod", "go");
    mappings.insert("go.sum", "plaintext");

    mappings
}

/// Detect language from a file path
#[tauri::command]
pub fn language_detect_from_path(path: String) -> Result<String, String> {
    let path = Path::new(&path);

    // Get the filename
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Check special filename mappings first
    let filename_mappings = get_filename_mappings();
    if let Some(&lang_id) = filename_mappings.get(filename.as_str()) {
        return Ok(lang_id.to_string());
    }

    // Check for files starting with specific patterns
    if filename.starts_with(".env") {
        return Ok("ini".to_string());
    }
    if filename.starts_with("dockerfile") {
        return Ok("dockerfile".to_string());
    }

    // Get extension
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()));

    if let Some(ext) = extension {
        let registry = get_language_registry();

        // Find language by extension
        for (lang_id, (_, extensions)) in registry.iter() {
            if extensions.contains(&ext.as_str()) {
                return Ok(lang_id.to_string());
            }
        }
    }

    // Default to plaintext
    Ok("plaintext".to_string())
}

/// Detect language with confidence scoring
#[tauri::command]
pub fn language_detect_with_confidence(
    path: String,
    content: Option<String>,
) -> Result<DetectionResult, String> {
    let path_obj = Path::new(&path);
    let filename = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Check special filename mappings (high confidence)
    let filename_mappings = get_filename_mappings();
    if let Some(&lang_id) = filename_mappings.get(filename.as_str()) {
        return Ok(DetectionResult {
            language_id: lang_id.to_string(),
            confidence: 1.0,
            method: "filename".to_string(),
        });
    }

    // Check extension (medium-high confidence)
    if let Some(ext) = path_obj.extension().and_then(|e| e.to_str()) {
        let ext_lower = format!(".{}", ext.to_lowercase());
        let registry = get_language_registry();

        for (lang_id, (_, extensions)) in registry.iter() {
            if extensions.contains(&ext_lower.as_str()) {
                return Ok(DetectionResult {
                    language_id: lang_id.to_string(),
                    confidence: 0.9,
                    method: "extension".to_string(),
                });
            }
        }
    }

    // Content-based detection (if provided)
    if let Some(ref content) = content {
        if let Some(result) = detect_from_content(content) {
            return Ok(result);
        }
    }

    // Default to plaintext with low confidence
    Ok(DetectionResult {
        language_id: "plaintext".to_string(),
        confidence: 0.1,
        method: "default".to_string(),
    })
}

/// Detect language from file content using shebang and patterns
fn detect_from_content(content: &str) -> Option<DetectionResult> {
    let first_line = content.lines().next()?;

    // Check shebang
    if first_line.starts_with("#!") {
        let shebang = first_line.to_lowercase();

        if shebang.contains("python") {
            return Some(DetectionResult {
                language_id: "python".to_string(),
                confidence: 0.95,
                method: "shebang".to_string(),
            });
        }
        if shebang.contains("node") || shebang.contains("deno") {
            return Some(DetectionResult {
                language_id: "javascript".to_string(),
                confidence: 0.95,
                method: "shebang".to_string(),
            });
        }
        if shebang.contains("ruby") {
            return Some(DetectionResult {
                language_id: "ruby".to_string(),
                confidence: 0.95,
                method: "shebang".to_string(),
            });
        }
        if shebang.contains("perl") {
            return Some(DetectionResult {
                language_id: "perl".to_string(),
                confidence: 0.95,
                method: "shebang".to_string(),
            });
        }
        if shebang.contains("bash") || shebang.contains("/sh") || shebang.contains("zsh") {
            return Some(DetectionResult {
                language_id: "shell".to_string(),
                confidence: 0.95,
                method: "shebang".to_string(),
            });
        }
    }

    // Check for XML declaration
    if first_line.starts_with("<?xml") {
        return Some(DetectionResult {
            language_id: "xml".to_string(),
            confidence: 0.9,
            method: "content".to_string(),
        });
    }

    // Check for HTML doctype
    if first_line.to_lowercase().starts_with("<!doctype html") {
        return Some(DetectionResult {
            language_id: "html".to_string(),
            confidence: 0.9,
            method: "content".to_string(),
        });
    }

    None
}

/// Get all available languages
#[tauri::command]
pub fn language_get_all() -> Vec<LanguageInfo> {
    let registry = get_language_registry();

    let mut languages: Vec<LanguageInfo> = registry
        .iter()
        .map(|(id, (name, extensions))| LanguageInfo {
            id: id.to_string(),
            name: name.to_string(),
            extensions: extensions.iter().map(|s| s.to_string()).collect(),
        })
        .collect();

    languages.sort_by(|a, b| a.name.cmp(&b.name));
    languages
}

/// Get language info by ID
#[tauri::command]
pub fn language_get_by_id(id: String) -> Option<LanguageInfo> {
    let registry = get_language_registry();

    registry
        .get(id.as_str())
        .map(|(name, extensions)| LanguageInfo {
            id,
            name: name.to_string(),
            extensions: extensions.iter().map(|s| s.to_string()).collect(),
        })
}

/// Get language by file extension
#[tauri::command]
pub fn language_get_by_extension(extension: String) -> Option<LanguageInfo> {
    let registry = get_language_registry();
    let ext = if extension.starts_with('.') {
        extension.to_lowercase()
    } else {
        format!(".{}", extension.to_lowercase())
    };

    for (id, (name, extensions)) in registry.iter() {
        if extensions.contains(&ext.as_str()) {
            return Some(LanguageInfo {
                id: id.to_string(),
                name: name.to_string(),
                extensions: extensions.iter().map(|s| s.to_string()).collect(),
            });
        }
    }

    None
}
