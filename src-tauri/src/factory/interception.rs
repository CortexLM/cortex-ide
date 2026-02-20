//! Interception Engine
//!
//! Evaluates rules and manages human-in-the-loop approval for agent actions.

use regex::Regex;
use std::collections::HashMap;

use super::types::{
    ApprovalStatus, DecisionAction, InterceptionActionType, InterceptionConfig, InterceptionRule,
    PendingApproval, RiskLevel, SupervisorDecision,
};

/// Interception engine for evaluating rules and managing approvals
pub struct InterceptionEngine {
    /// Configuration
    config: InterceptionConfig,
    /// Compiled regex patterns by rule ID
    compiled_patterns: HashMap<String, Regex>,
    /// Active approval requests by ID
    pending_approvals: HashMap<String, PendingApproval>,
    /// ID counter
    next_id: u64,
}

impl InterceptionEngine {
    pub fn new() -> Self {
        Self {
            config: InterceptionConfig::default(),
            compiled_patterns: HashMap::new(),
            pending_approvals: HashMap::new(),
            next_id: 1,
        }
    }

    /// Set the interception configuration
    pub fn set_config(&mut self, config: InterceptionConfig) {
        self.config = config;
        self.compile_patterns();
    }

    /// Get the current configuration
    pub fn get_config(&self) -> &InterceptionConfig {
        &self.config
    }

    /// Compile regex patterns from rules
    fn compile_patterns(&mut self) {
        self.compiled_patterns.clear();
        for rule in &self.config.rules {
            if rule.enabled {
                if let Ok(regex) = Regex::new(&rule.pattern) {
                    self.compiled_patterns.insert(rule.id.clone(), regex);
                }
            }
        }
    }

    /// Add a rule
    pub fn add_rule(&mut self, rule: InterceptionRule) {
        // Compile the pattern
        if rule.enabled {
            if let Ok(regex) = Regex::new(&rule.pattern) {
                self.compiled_patterns.insert(rule.id.clone(), regex);
            }
        }
        self.config.rules.push(rule);
    }

    /// Remove a rule
    pub fn remove_rule(&mut self, rule_id: &str) -> bool {
        self.compiled_patterns.remove(rule_id);
        let len_before = self.config.rules.len();
        self.config.rules.retain(|r| r.id != rule_id);
        self.config.rules.len() < len_before
    }

    /// Evaluate an action against rules
    pub fn evaluate(
        &self,
        action_type: InterceptionActionType,
        action_target: &str,
        _context: &serde_json::Value,
    ) -> InterceptionResult {
        if !self.config.enabled {
            return InterceptionResult::allow();
        }

        let mut triggered_rules = Vec::new();
        let mut max_risk_level = RiskLevel::None;

        // Check each rule
        for rule in &self.config.rules {
            if !rule.enabled {
                continue;
            }

            // Check if rule applies to this action type
            if rule.action_type != InterceptionActionType::All && rule.action_type != action_type {
                continue;
            }

            // Check pattern match
            let matches = if let Some(regex) = self.compiled_patterns.get(&rule.id) {
                regex.is_match(action_target)
            } else {
                // Simple glob-style matching
                self.glob_match(&rule.pattern, action_target)
            };

            if matches {
                triggered_rules.push(rule.id.clone());
                if rule.risk_level > max_risk_level {
                    max_risk_level = rule.risk_level;
                }

                // Check for required decision
                if let Some(decision) = &rule.required_decision {
                    return match decision {
                        DecisionAction::Deny => {
                            InterceptionResult::deny(triggered_rules, max_risk_level)
                        }
                        DecisionAction::Approve => InterceptionResult::allow(),
                        _ => InterceptionResult::require_approval(triggered_rules, max_risk_level),
                    };
                }
            }
        }

        // Check against thresholds
        if max_risk_level >= self.config.auto_deny_threshold {
            return InterceptionResult::deny(triggered_rules, max_risk_level);
        }

        if max_risk_level <= self.config.auto_approve_threshold && triggered_rules.is_empty() {
            return InterceptionResult::allow();
        }

        if !triggered_rules.is_empty() {
            return InterceptionResult::require_approval(triggered_rules, max_risk_level);
        }

        InterceptionResult::allow()
    }

    /// Simple glob-style pattern matching
    fn glob_match(&self, pattern: &str, target: &str) -> bool {
        let pattern = pattern.replace('.', r"\.");
        let pattern = pattern.replace('*', ".*");
        let pattern = pattern.replace('?', ".");
        let pattern = format!("^{}$", pattern);

        if let Ok(regex) = Regex::new(&pattern) {
            regex.is_match(target)
        } else {
            false
        }
    }

    /// Create a pending approval request
    #[allow(clippy::too_many_arguments)]
    pub fn create_approval(
        &mut self,
        execution_id: &str,
        node_id: &str,
        agent_id: Option<&str>,
        description: &str,
        action_type: InterceptionActionType,
        action_params: serde_json::Value,
        risk_level: RiskLevel,
        triggered_rules: Vec<String>,
    ) -> PendingApproval {
        let approval_id = format!("approval_{}", self.next_id);
        self.next_id += 1;

        let now = Self::now_ms();
        let expires_at = now + self.config.approval_timeout_ms;

        let approval = PendingApproval {
            id: approval_id.clone(),
            execution_id: execution_id.to_string(),
            node_id: node_id.to_string(),
            agent_id: agent_id.map(|s| s.to_string()),
            description: description.to_string(),
            context: None,
            action_type,
            action_params,
            risk_level,
            triggered_rules,
            requested_at: now,
            expires_at,
            status: ApprovalStatus::Pending,
            decision: None,
        };

        self.pending_approvals.insert(approval_id, approval.clone());
        approval
    }

    /// Process a decision on an approval
    pub fn process_decision(
        &mut self,
        approval_id: &str,
        decision: SupervisorDecision,
    ) -> Result<(), String> {
        let approval = self
            .pending_approvals
            .get_mut(approval_id)
            .ok_or_else(|| format!("Approval not found: {}", approval_id))?;

        if approval.status != ApprovalStatus::Pending {
            return Err("Approval is no longer pending".to_string());
        }

        approval.status = match decision.action {
            DecisionAction::Approve => ApprovalStatus::Approved,
            DecisionAction::Deny => ApprovalStatus::Denied,
            DecisionAction::Modify => ApprovalStatus::Modified,
            DecisionAction::Defer => ApprovalStatus::Pending,
        };
        approval.decision = Some(decision);

        Ok(())
    }

    /// Check for expired approvals
    pub fn check_expired(&mut self) -> Vec<String> {
        let now = Self::now_ms();
        let mut expired = Vec::new();

        for (id, approval) in &mut self.pending_approvals {
            if approval.status == ApprovalStatus::Pending && approval.expires_at <= now {
                approval.status = ApprovalStatus::Expired;
                expired.push(id.clone());
            }
        }

        expired
    }

    /// Get a pending approval
    pub fn get_approval(&self, approval_id: &str) -> Option<&PendingApproval> {
        self.pending_approvals.get(approval_id)
    }

    /// List all pending approvals
    pub fn list_pending(&self) -> Vec<&PendingApproval> {
        self.pending_approvals
            .values()
            .filter(|a| a.status == ApprovalStatus::Pending)
            .collect()
    }

    /// Remove an approval
    pub fn remove_approval(&mut self, approval_id: &str) -> Option<PendingApproval> {
        self.pending_approvals.remove(approval_id)
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

impl Default for InterceptionEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of evaluating an action against interception rules
#[derive(Debug, Clone)]
pub struct InterceptionResult {
    /// Whether the action is allowed
    pub allowed: bool,
    /// Whether approval is required
    pub requires_approval: bool,
    /// Rules that were triggered
    pub triggered_rules: Vec<String>,
    /// Maximum risk level from triggered rules
    pub risk_level: RiskLevel,
    /// Reason for the decision
    pub reason: Option<String>,
}

impl InterceptionResult {
    /// Create an allow result
    pub fn allow() -> Self {
        Self {
            allowed: true,
            requires_approval: false,
            triggered_rules: Vec::new(),
            risk_level: RiskLevel::None,
            reason: None,
        }
    }

    /// Create a deny result
    pub fn deny(triggered_rules: Vec<String>, risk_level: RiskLevel) -> Self {
        Self {
            allowed: false,
            requires_approval: false,
            triggered_rules,
            risk_level,
            reason: Some("Action denied by interception rules".to_string()),
        }
    }

    /// Create a result requiring approval
    pub fn require_approval(triggered_rules: Vec<String>, risk_level: RiskLevel) -> Self {
        Self {
            allowed: false,
            requires_approval: true,
            triggered_rules,
            risk_level,
            reason: Some("Action requires approval".to_string()),
        }
    }
}
