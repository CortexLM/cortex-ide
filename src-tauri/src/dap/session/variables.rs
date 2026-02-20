//! Variable inspection and evaluation

use anyhow::{Context, Result};

use crate::dap::protocol::{
    CompletionsResponse, EvaluateResponse, Scope, SetExpressionResponse, SetVariableResponse,
    Variable,
};

use super::core::DebugSession;
use super::types::DebugSessionEvent;

impl DebugSession {
    /// Get scopes for a stack frame
    pub async fn get_scopes(&self, frame_id: i64) -> Result<Vec<Scope>> {
        self.client.scopes(frame_id).await
    }

    /// Get variables for current frame
    pub async fn get_variables(&self) -> Result<Vec<Variable>> {
        let frame_id = self.active_frame_id.read().await;
        let frame_id = frame_id.context("No active frame")?;

        let scopes = self.client.scopes(frame_id).await?;
        let mut all_variables = Vec::new();

        for scope in scopes {
            let variables = self.client.variables(scope.variables_reference).await?;
            all_variables.extend(variables);
        }

        self.external_event_tx
            .send(DebugSessionEvent::VariablesUpdated {
                variables: all_variables.clone(),
            })
            .ok();

        Ok(all_variables)
    }

    /// Expand a variable (get children)
    pub async fn expand_variable(&self, variables_reference: i64) -> Result<Vec<Variable>> {
        self.client.variables(variables_reference).await
    }

    /// Expand a variable with paging support (get children with start/count)
    pub async fn expand_variable_paged(
        &self,
        variables_reference: i64,
        start: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<Variable>> {
        self.client
            .variables_paged(variables_reference, start, count)
            .await
    }

    /// Evaluate an expression
    pub async fn evaluate(
        &self,
        expression: &str,
        context: Option<&str>,
    ) -> Result<EvaluateResponse> {
        let frame_id = *self.active_frame_id.read().await;
        self.client.evaluate(expression, frame_id, context).await
    }

    /// Set the value of a variable
    pub async fn set_variable(
        &self,
        variables_reference: i64,
        name: &str,
        value: &str,
    ) -> Result<SetVariableResponse> {
        self.client
            .set_variable(variables_reference, name, value)
            .await
    }

    /// Get completions for debug console input
    pub async fn completions(
        &self,
        text: &str,
        column: i64,
        line: Option<i64>,
    ) -> Result<CompletionsResponse> {
        let frame_id = *self.active_frame_id.read().await;
        self.client.completions(frame_id, text, column, line).await
    }

    /// Set an expression value
    pub async fn set_expression(
        &self,
        expression: &str,
        value: &str,
        frame_id: Option<i64>,
    ) -> Result<SetExpressionResponse> {
        self.client
            .set_expression(expression, value, frame_id)
            .await
    }
}
