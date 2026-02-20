//! MCP Protocol Implementation
//!
//! Implements the Model Context Protocol client for communicating with context servers.

use anyhow::{Context, Result};
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, Ordering};

use super::transport::{AsyncHttpTransport, AsyncStdioTransport};
use super::types::*;

const JSON_RPC_VERSION: &str = "2.0";

/// MCP Protocol client
pub struct McpClient {
    transport: McpTransport,
    next_id: AtomicI32,
    pub capabilities: ServerCapabilities,
    pub server_info: Option<Implementation>,
    initialized: bool,
}

/// Transport enum for different connection types
pub enum McpTransport {
    Stdio(AsyncStdioTransport),
    Http(AsyncHttpTransport),
}

impl McpClient {
    /// Create a new MCP client with stdio transport
    pub async fn new_stdio(
        command: &str,
        args: &[String],
        env: Option<&HashMap<String, String>>,
        working_dir: Option<&str>,
    ) -> Result<Self> {
        let transport = AsyncStdioTransport::new(command, args, env, working_dir).await?;

        Ok(Self {
            transport: McpTransport::Stdio(transport),
            next_id: AtomicI32::new(1),
            capabilities: ServerCapabilities::default(),
            server_info: None,
            initialized: false,
        })
    }

    /// Create a new MCP client with HTTP transport
    pub fn new_http(endpoint: &str, headers: HashMap<String, String>) -> Result<Self> {
        let transport = AsyncHttpTransport::new(endpoint, headers)?;

        Ok(Self {
            transport: McpTransport::Http(transport),
            next_id: AtomicI32::new(1),
            capabilities: ServerCapabilities::default(),
            server_info: None,
            initialized: false,
        })
    }

    /// Initialize the MCP connection
    pub async fn initialize(&mut self) -> Result<InitializeResponse> {
        let params = InitializeParams {
            protocol_version: LATEST_PROTOCOL_VERSION.to_string(),
            capabilities: ClientCapabilities::default(),
            client_info: Implementation {
                name: "Cortex".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            meta: None,
        };

        let response: InitializeResponse = self.request("initialize", Some(params)).await?;

        self.capabilities = response.capabilities.clone();
        self.server_info = Some(response.server_info.clone());
        self.initialized = true;

        // Send initialized notification
        self.notify("notifications/initialized", Option::<()>::None)
            .await?;

        Ok(response)
    }

    /// Check if the client is initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Ping the server
    pub async fn ping(&self) -> Result<()> {
        self.request::<(), ()>("ping", None).await
    }

    /// List available resources
    pub async fn list_resources(&self) -> Result<ResourcesListResponse> {
        self.request("resources/list", Option::<()>::None).await
    }

    /// Read a resource by URI
    pub async fn read_resource(&self, uri: &str) -> Result<ResourcesReadResponse> {
        let params = ResourcesReadParams {
            uri: uri.to_string(),
        };
        self.request("resources/read", Some(params)).await
    }

    /// List resource templates
    pub async fn list_resource_templates(&self) -> Result<ResourceTemplatesListResponse> {
        self.request("resources/templates/list", Option::<()>::None)
            .await
    }

    /// List available tools
    pub async fn list_tools(&self) -> Result<ToolsListResponse> {
        self.request("tools/list", Option::<()>::None).await
    }

    /// Call a tool
    pub async fn call_tool(
        &self,
        name: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<CallToolResponse> {
        let params = CallToolParams {
            name: name.to_string(),
            arguments,
        };
        self.request("tools/call", Some(params)).await
    }

    /// List available prompts
    pub async fn list_prompts(&self) -> Result<PromptsListResponse> {
        self.request("prompts/list", Option::<()>::None).await
    }

    /// Get a specific prompt
    pub async fn get_prompt(
        &self,
        name: &str,
        arguments: Option<HashMap<String, String>>,
    ) -> Result<PromptsGetResponse> {
        let params = PromptsGetParams {
            name: name.to_string(),
            arguments,
        };
        self.request("prompts/get", Some(params)).await
    }

    /// List roots
    pub async fn list_roots(&self) -> Result<RootsListResponse> {
        self.request("roots/list", Option::<()>::None).await
    }

    /// Set logging level
    pub async fn set_logging_level(&self, level: LoggingLevel) -> Result<()> {
        let params = LoggingSetLevelParams { level };
        self.request::<_, ()>("logging/setLevel", Some(params))
            .await
    }

    /// Get completions
    pub async fn complete(
        &self,
        params: CompletionCompleteParams,
    ) -> Result<CompletionCompleteResponse> {
        self.request("completion/complete", Some(params)).await
    }

    /// Send a JSON-RPC request and wait for response
    async fn request<P: Serialize, R: DeserializeOwned>(
        &self,
        method: &str,
        params: Option<P>,
    ) -> Result<R> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst) as i64;

        let request = JsonRpcRequest {
            jsonrpc: JSON_RPC_VERSION.to_string(),
            id: RequestId::Int(id),
            method: method.to_string(),
            params,
        };

        let request_json =
            serde_json::to_string(&request).context("Failed to serialize request")?;

        let response_json = match &self.transport {
            McpTransport::Stdio(transport) => {
                transport.send_async(&request_json).await?;
                transport.receive_async().await?
            }
            McpTransport::Http(transport) => transport.request(&request_json).await?,
        };

        let response: JsonRpcResponse<R> =
            serde_json::from_str(&response_json).context("Failed to parse response")?;

        if let Some(error) = response.error {
            return Err(anyhow::anyhow!(
                "MCP error {}: {}",
                error.code,
                error.message
            ));
        }

        response
            .result
            .context("Missing result in successful response")
    }

    /// Send a JSON-RPC notification (no response expected)
    async fn notify<P: Serialize>(&self, method: &str, params: Option<P>) -> Result<()> {
        let notification = JsonRpcNotification {
            jsonrpc: JSON_RPC_VERSION.to_string(),
            method: method.to_string(),
            params,
        };

        let notification_json =
            serde_json::to_string(&notification).context("Failed to serialize notification")?;

        match &self.transport {
            McpTransport::Stdio(transport) => {
                transport.send_async(&notification_json).await?;
            }
            McpTransport::Http(_) => {
                // HTTP transport doesn't typically support one-way notifications
                // Some implementations might, so we just log and continue
                tracing::debug!("Notification sent via HTTP (one-way): {}", method);
            }
        }

        Ok(())
    }

    /// Check if the server supports a capability
    pub fn has_capability(&self, capability: Capability) -> bool {
        match capability {
            Capability::Resources => self.capabilities.resources.is_some(),
            Capability::Tools => self.capabilities.tools.is_some(),
            Capability::Prompts => self.capabilities.prompts.is_some(),
            Capability::Logging => self.capabilities.logging.is_some(),
            Capability::Completions => self.capabilities.completions.is_some(),
        }
    }

    /// Shutdown the client
    pub async fn shutdown(&self) -> Result<()> {
        if let McpTransport::Stdio(transport) = &self.transport {
            transport.kill().await?;
        }
        Ok(())
    }
}

/// Server capabilities to check
#[derive(Debug, Clone, Copy)]
pub enum Capability {
    Resources,
    Tools,
    Prompts,
    Logging,
    Completions,
}

/// Builder for creating MCP clients
pub struct McpClientBuilder {
    config: ContextServerConfig,
}

impl McpClientBuilder {
    pub fn new(config: ContextServerConfig) -> Self {
        Self { config }
    }

    /// Build and connect the MCP client
    pub async fn connect(self) -> Result<McpClient> {
        let client = match self.config.server_type {
            ServerType::Stdio => {
                let command = self
                    .config
                    .command
                    .as_ref()
                    .context("Command required for stdio transport")?;
                let args = self.config.args.as_deref().unwrap_or(&[]);
                let env = self.config.env.as_ref();
                let working_dir = self.config.working_directory.as_deref();

                McpClient::new_stdio(command, args, env, working_dir).await?
            }
            ServerType::Http | ServerType::Sse => {
                let url = self
                    .config
                    .url
                    .as_ref()
                    .context("URL required for HTTP transport")?;
                let headers = self.config.headers.clone().unwrap_or_default();

                McpClient::new_http(url, headers)?
            }
        };

        Ok(client)
    }

    /// Build, connect, and initialize the MCP client
    pub async fn connect_and_initialize(self) -> Result<McpClient> {
        let mut client = self.connect().await?;
        client.initialize().await?;
        Ok(client)
    }
}

/// Helper to aggregate context from multiple resources
pub struct ContextAggregator {
    contents: Vec<ResourceContents>,
}

impl ContextAggregator {
    pub fn new() -> Self {
        Self {
            contents: Vec::new(),
        }
    }

    /// Add resource contents
    pub fn add(&mut self, contents: ResourceContents) {
        self.contents.push(contents);
    }

    /// Add multiple resource contents
    pub fn add_all(&mut self, contents: Vec<ResourceContents>) {
        self.contents.extend(contents);
    }

    /// Get all text content as a single string
    pub fn get_text(&self) -> String {
        self.contents
            .iter()
            .filter_map(|c| c.text.as_ref())
            .cloned()
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    /// Get all contents
    pub fn get_contents(&self) -> &[ResourceContents] {
        &self.contents
    }

    /// Clear all contents
    pub fn clear(&mut self) {
        self.contents.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.contents.is_empty()
    }
}

impl Default for ContextAggregator {
    fn default() -> Self {
        Self::new()
    }
}
