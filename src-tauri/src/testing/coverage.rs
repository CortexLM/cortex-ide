//! Code coverage functionality

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Coverage report structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageReport {
    pub files: Vec<FileCoverage>,
    pub summary: CoverageSummary,
}

/// Coverage data for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCoverage {
    pub path: String,
    pub lines: Vec<LineCoverage>,
    pub line_rate: f64,
    pub branch_rate: f64,
    pub functions_hit: u32,
    pub functions_total: u32,
}

/// Line-level coverage data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineCoverage {
    pub line: u32,
    pub hits: u32,
    pub branch_coverage: Option<BranchCoverage>,
}

/// Branch coverage for a line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchCoverage {
    pub covered: u32,
    pub total: u32,
}

/// Summary of coverage across all files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageSummary {
    pub lines_total: u32,
    pub lines_covered: u32,
    pub lines_percentage: f64,
    pub branches_total: u32,
    pub branches_covered: u32,
    pub branches_percentage: f64,
    pub functions_total: u32,
    pub functions_covered: u32,
    pub functions_percentage: f64,
}

/// Run tests with coverage and return parsed coverage report
#[tauri::command]
pub async fn testing_coverage(
    path: String,
    framework: String,
    test_pattern: Option<String>,
) -> Result<CoverageReport, String> {
    let path_buf = PathBuf::from(&path);

    // Build coverage command based on framework
    let (command, args, coverage_path) = match framework.to_lowercase().as_str() {
        "jest" => {
            let mut args = vec![
                "jest".to_string(),
                "--coverage".to_string(),
                "--coverageReporters=json".to_string(),
                "--coverageDirectory=coverage".to_string(),
            ];
            if let Some(pattern) = &test_pattern {
                args.push(format!("--testPathPattern={}", pattern));
            }
            ("npx", args, path_buf.join("coverage/coverage-final.json"))
        }
        "vitest" => {
            let mut args = vec![
                "vitest".to_string(),
                "run".to_string(),
                "--coverage".to_string(),
                "--coverage.reporter=json".to_string(),
            ];
            if let Some(pattern) = &test_pattern {
                args.push(format!("--testNamePattern={}", pattern));
            }
            ("npx", args, path_buf.join("coverage/coverage-final.json"))
        }
        "pytest" => {
            let mut args = vec![
                "--cov".to_string(),
                "--cov-report=json:coverage/coverage.json".to_string(),
            ];
            if let Some(pattern) = &test_pattern {
                args.push("-k".to_string());
                args.push(pattern.clone());
            }
            ("pytest", args, path_buf.join("coverage/coverage.json"))
        }
        "cargo" => {
            // cargo-llvm-cov or cargo-tarpaulin
            let mut args = vec![
                "llvm-cov".to_string(),
                "--json".to_string(),
                "--output-path".to_string(),
                "coverage/coverage.json".to_string(),
            ];
            if let Some(pattern) = &test_pattern {
                args.push("--".to_string());
                args.push(pattern.clone());
            }
            ("cargo", args, path_buf.join("coverage/coverage.json"))
        }
        _ => return Err(format!("Unsupported framework for coverage: {}", framework)),
    };

    // Run coverage command
    let output = crate::process_utils::async_command(command)
        .args(&args)
        .current_dir(&path_buf)
        .output()
        .await
        .map_err(|e| format!("Failed to run coverage command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Don't fail on test failures - coverage should still be available
        if !coverage_path.exists() {
            return Err(format!("Coverage command failed: {}", stderr));
        }
    }

    // Try to read and parse coverage file
    if coverage_path.exists() {
        let content = fs::read_to_string(&coverage_path)
            .await
            .map_err(|e| format!("Failed to read coverage file: {}", e))?;

        parse_coverage_json(&content, &framework)
    } else {
        // Try LCOV format as fallback
        let lcov_path = path_buf.join("coverage/lcov.info");
        if lcov_path.exists() {
            let content = fs::read_to_string(&lcov_path)
                .await
                .map_err(|e| format!("Failed to read lcov file: {}", e))?;
            parse_lcov_coverage(&content)
        } else {
            Err("No coverage file found after running tests".to_string())
        }
    }
}

/// Parse Istanbul/NYC JSON coverage format
fn parse_coverage_json(content: &str, _framework: &str) -> Result<CoverageReport, String> {
    let json: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse coverage JSON: {}", e))?;

    let mut files = Vec::new();
    let mut total_lines = 0u32;
    let mut covered_lines = 0u32;
    let mut total_branches = 0u32;
    let mut covered_branches = 0u32;
    let mut total_functions = 0u32;
    let mut covered_functions = 0u32;

    // Handle different JSON formats
    let file_entries: HashMap<String, serde_json::Value> = if json.is_object() {
        // Istanbul format: { "path/to/file.js": { ... } }
        json.as_object()
            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
            .unwrap_or_default()
    } else {
        return Err("Unexpected coverage JSON format".to_string());
    };

    for (file_path, file_data) in file_entries {
        if file_path == "total" {
            continue; // Skip summary entries
        }

        let mut lines = Vec::new();
        let mut file_lines_total = 0u32;
        let mut file_lines_covered = 0u32;
        let mut file_branches_total = 0u32;
        let mut file_branches_covered = 0u32;
        let mut file_functions_total = 0u32;
        let mut file_functions_covered = 0u32;

        // Parse statement/line coverage
        if let Some(stmt_map) = file_data.get("statementMap") {
            if let Some(s) = file_data.get("s") {
                if let (Some(stmt_obj), Some(s_obj)) = (stmt_map.as_object(), s.as_object()) {
                    for (id, location) in stmt_obj {
                        if let Some(start) = location
                            .get("start")
                            .and_then(|s| s.get("line"))
                            .and_then(|l| l.as_u64())
                        {
                            let hits = s_obj.get(id).and_then(|h| h.as_u64()).unwrap_or(0) as u32;

                            file_lines_total += 1;
                            if hits > 0 {
                                file_lines_covered += 1;
                            }

                            lines.push(LineCoverage {
                                line: start as u32,
                                hits,
                                branch_coverage: None,
                            });
                        }
                    }
                }
            }
        }

        // Parse branch coverage
        if let Some(branch_map) = file_data.get("branchMap") {
            if let Some(b) = file_data.get("b") {
                if let (Some(branch_obj), Some(b_obj)) = (branch_map.as_object(), b.as_object()) {
                    for (id, branch_info) in branch_obj {
                        if let Some(locations) =
                            branch_info.get("locations").and_then(|l| l.as_array())
                        {
                            if let Some(branch_hits) = b_obj.get(id).and_then(|h| h.as_array()) {
                                let total = locations.len() as u32;
                                let covered = branch_hits
                                    .iter()
                                    .filter(|h| h.as_u64().unwrap_or(0) > 0)
                                    .count() as u32;

                                file_branches_total += total;
                                file_branches_covered += covered;

                                // Add branch info to the line
                                if let Some(loc) = locations.first() {
                                    if let Some(line) = loc
                                        .get("start")
                                        .and_then(|s| s.get("line"))
                                        .and_then(|l| l.as_u64())
                                    {
                                        if let Some(line_cov) =
                                            lines.iter_mut().find(|l| l.line == line as u32)
                                        {
                                            line_cov.branch_coverage =
                                                Some(BranchCoverage { covered, total });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Parse function coverage
        if let Some(fn_map) = file_data.get("fnMap") {
            if let Some(f) = file_data.get("f") {
                if let (Some(_fn_obj), Some(f_obj)) = (fn_map.as_object(), f.as_object()) {
                    for (_id, hits) in f_obj {
                        file_functions_total += 1;
                        if hits.as_u64().unwrap_or(0) > 0 {
                            file_functions_covered += 1;
                        }
                    }
                }
            }
        }

        // Sort lines by line number
        lines.sort_by_key(|l| l.line);

        // Calculate rates
        let line_rate = if file_lines_total > 0 {
            file_lines_covered as f64 / file_lines_total as f64
        } else {
            0.0
        };
        let branch_rate = if file_branches_total > 0 {
            file_branches_covered as f64 / file_branches_total as f64
        } else {
            0.0
        };

        files.push(FileCoverage {
            path: file_path,
            lines,
            line_rate,
            branch_rate,
            functions_hit: file_functions_covered,
            functions_total: file_functions_total,
        });

        total_lines += file_lines_total;
        covered_lines += file_lines_covered;
        total_branches += file_branches_total;
        covered_branches += file_branches_covered;
        total_functions += file_functions_total;
        covered_functions += file_functions_covered;
    }

    // Calculate summary percentages
    let lines_percentage = if total_lines > 0 {
        (covered_lines as f64 / total_lines as f64) * 100.0
    } else {
        0.0
    };
    let branches_percentage = if total_branches > 0 {
        (covered_branches as f64 / total_branches as f64) * 100.0
    } else {
        0.0
    };
    let functions_percentage = if total_functions > 0 {
        (covered_functions as f64 / total_functions as f64) * 100.0
    } else {
        0.0
    };

    Ok(CoverageReport {
        files,
        summary: CoverageSummary {
            lines_total: total_lines,
            lines_covered: covered_lines,
            lines_percentage,
            branches_total: total_branches,
            branches_covered: covered_branches,
            branches_percentage,
            functions_total: total_functions,
            functions_covered: covered_functions,
            functions_percentage,
        },
    })
}

/// Parse LCOV coverage format
fn parse_lcov_coverage(content: &str) -> Result<CoverageReport, String> {
    let mut files = Vec::new();
    let mut current_file: Option<String> = None;
    let mut current_lines: Vec<LineCoverage> = Vec::new();
    let mut current_branches: HashMap<u32, BranchCoverage> = HashMap::new();
    let mut current_functions_hit = 0u32;
    let mut current_functions_total = 0u32;

    let mut total_lines = 0u32;
    let mut covered_lines = 0u32;
    let mut total_branches = 0u32;
    let mut covered_branches = 0u32;
    let mut total_functions = 0u32;
    let mut covered_functions = 0u32;

    for line in content.lines() {
        let line = line.trim();

        if let Some(stripped) = line.strip_prefix("SF:") {
            // Source file
            current_file = Some(stripped.to_string());
            current_lines.clear();
            current_branches.clear();
            current_functions_hit = 0;
            current_functions_total = 0;
        } else if let Some(stripped) = line.strip_prefix("DA:") {
            // Line data: DA:<line number>,<execution count>
            let parts: Vec<&str> = stripped.split(',').collect();
            if parts.len() >= 2 {
                if let (Ok(line_num), Ok(hits)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>())
                {
                    current_lines.push(LineCoverage {
                        line: line_num,
                        hits,
                        branch_coverage: None,
                    });
                }
            }
        } else if let Some(stripped) = line.strip_prefix("BRDA:") {
            // Branch data: BRDA:<line>,<block>,<branch>,<taken>
            let parts: Vec<&str> = stripped.split(',').collect();
            if parts.len() >= 4 {
                if let Ok(line_num) = parts[0].parse::<u32>() {
                    let taken = if parts[3] == "-" {
                        0
                    } else {
                        parts[3].parse::<u32>().unwrap_or(0)
                    };
                    let entry = current_branches.entry(line_num).or_insert(BranchCoverage {
                        covered: 0,
                        total: 0,
                    });
                    entry.total += 1;
                    if taken > 0 {
                        entry.covered += 1;
                    }
                }
            }
        } else if let Some(stripped) = line.strip_prefix("FNF:") {
            // Functions found
            if let Ok(count) = stripped.parse::<u32>() {
                current_functions_total = count;
            }
        } else if let Some(stripped) = line.strip_prefix("FNH:") {
            // Functions hit
            if let Ok(count) = stripped.parse::<u32>() {
                current_functions_hit = count;
            }
        } else if line == "end_of_record" {
            // End of file record
            if let Some(file_path) = current_file.take() {
                // Apply branch coverage to lines
                for line_cov in &mut current_lines {
                    if let Some(branch) = current_branches.get(&line_cov.line) {
                        line_cov.branch_coverage = Some(branch.clone());
                    }
                }

                // Sort lines
                current_lines.sort_by_key(|l| l.line);

                // Calculate file statistics
                let file_lines_total = current_lines.len() as u32;
                let file_lines_covered = current_lines.iter().filter(|l| l.hits > 0).count() as u32;
                let file_branches_total: u32 = current_branches.values().map(|b| b.total).sum();
                let file_branches_covered: u32 = current_branches.values().map(|b| b.covered).sum();

                let line_rate = if file_lines_total > 0 {
                    file_lines_covered as f64 / file_lines_total as f64
                } else {
                    0.0
                };
                let branch_rate = if file_branches_total > 0 {
                    file_branches_covered as f64 / file_branches_total as f64
                } else {
                    0.0
                };

                files.push(FileCoverage {
                    path: file_path,
                    lines: std::mem::take(&mut current_lines),
                    line_rate,
                    branch_rate,
                    functions_hit: current_functions_hit,
                    functions_total: current_functions_total,
                });

                total_lines += file_lines_total;
                covered_lines += file_lines_covered;
                total_branches += file_branches_total;
                covered_branches += file_branches_covered;
                total_functions += current_functions_total;
                covered_functions += current_functions_hit;

                current_branches.clear();
            }
        }
    }

    // Calculate summary percentages
    let lines_percentage = if total_lines > 0 {
        (covered_lines as f64 / total_lines as f64) * 100.0
    } else {
        0.0
    };
    let branches_percentage = if total_branches > 0 {
        (covered_branches as f64 / total_branches as f64) * 100.0
    } else {
        0.0
    };
    let functions_percentage = if total_functions > 0 {
        (covered_functions as f64 / total_functions as f64) * 100.0
    } else {
        0.0
    };

    Ok(CoverageReport {
        files,
        summary: CoverageSummary {
            lines_total: total_lines,
            lines_covered: covered_lines,
            lines_percentage,
            branches_total: total_branches,
            branches_covered: covered_branches,
            branches_percentage,
            functions_total: total_functions,
            functions_covered: covered_functions,
            functions_percentage,
        },
    })
}

/// Get coverage data for a specific file (from cached/loaded coverage)
#[tauri::command]
pub async fn testing_get_file_coverage(
    coverage_path: String,
    file_path: String,
) -> Result<Option<FileCoverage>, String> {
    let path = PathBuf::from(&coverage_path);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read coverage file: {}", e))?;

    // Determine format and parse
    let report = if coverage_path.ends_with(".json") {
        parse_coverage_json(&content, "unknown")?
    } else {
        parse_lcov_coverage(&content)?
    };

    // Find the file
    let normalized_path = file_path.replace("\\", "/");
    Ok(report.files.into_iter().find(|f| {
        let f_normalized = f.path.replace("\\", "/");
        f_normalized == normalized_path
            || f_normalized.ends_with(&normalized_path)
            || normalized_path.ends_with(&f_normalized)
    }))
}
