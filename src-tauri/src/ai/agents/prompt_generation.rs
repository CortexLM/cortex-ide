//! AI-powered and template-based prompt generation

/// Generate system prompt from description using AI
/// Attempts to use AI API if available, falls back to intelligent template generation
#[tauri::command]
pub async fn agent_generate_prompt(description: String) -> Result<String, String> {
    // Try AI-powered generation first
    if let Ok(ai_generated) = generate_prompt_with_ai(&description).await {
        return Ok(ai_generated);
    }

    // Fall back to intelligent template generation
    generate_prompt_with_templates(&description)
}

/// Generate prompt using AI API (OpenAI or Anthropic)
async fn generate_prompt_with_ai(description: &str) -> Result<String, String> {
    // Check for API keys
    let api_key = std::env::var("OPENAI_API_KEY")
        .or_else(|_| std::env::var("ANTHROPIC_API_KEY"))
        .map_err(|_| "No API key configured")?;

    let is_anthropic =
        std::env::var("ANTHROPIC_API_KEY").is_ok() && std::env::var("OPENAI_API_KEY").is_err();

    let meta_prompt = format!(
        r#"Generate a comprehensive system prompt for an AI agent based on the following description. 
The system prompt should:
1. Clearly define the agent's role and expertise
2. List specific responsibilities and capabilities
3. Include guidelines for behavior and communication style
4. Specify any constraints or limitations
5. Be professional and actionable

User's description of the desired agent:
"{}"

Generate ONLY the system prompt text, no explanations or meta-commentary."#,
        description
    );

    let client = reqwest::Client::new();

    let (api_url, request_body) = if is_anthropic {
        (
            "https://api.anthropic.com/v1/messages",
            serde_json::json!({
                "model": "claude-3-haiku-20240307",
                "max_tokens": 1024,
                "messages": [{
                    "role": "user",
                    "content": meta_prompt
                }]
            }),
        )
    } else {
        (
            "https://api.openai.com/v1/chat/completions",
            serde_json::json!({
                "model": "gpt-3.5-turbo",
                "messages": [{
                    "role": "user",
                    "content": meta_prompt
                }],
                "max_tokens": 1024,
                "temperature": 0.7
            }),
        )
    };

    let mut req = client.post(api_url).json(&request_body);

    if is_anthropic {
        req = req
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract content based on API type
    let content = if is_anthropic {
        json["content"][0]["text"]
            .as_str()
            .ok_or("Missing content in Anthropic response")?
            .to_string()
    } else {
        json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("Missing content in OpenAI response")?
            .to_string()
    };

    Ok(content)
}

/// Generate prompt using intelligent templates based on description analysis
fn generate_prompt_with_templates(description: &str) -> Result<String, String> {
    let desc_lower = description.to_lowercase();

    // Detect multiple intent categories
    let is_coding = desc_lower.contains("code")
        || desc_lower.contains("program")
        || desc_lower.contains("develop")
        || desc_lower.contains("software")
        || desc_lower.contains("typescript")
        || desc_lower.contains("rust")
        || desc_lower.contains("python")
        || desc_lower.contains("javascript");

    let is_research = desc_lower.contains("research")
        || desc_lower.contains("analyze")
        || desc_lower.contains("investigate")
        || desc_lower.contains("study");

    let is_testing = desc_lower.contains("test")
        || desc_lower.contains("quality")
        || desc_lower.contains("qa")
        || desc_lower.contains("verify");

    let is_review = desc_lower.contains("review")
        || desc_lower.contains("audit")
        || desc_lower.contains("check")
        || desc_lower.contains("examine");

    let is_writing = desc_lower.contains("write")
        || desc_lower.contains("content")
        || desc_lower.contains("document")
        || desc_lower.contains("blog")
        || desc_lower.contains("article");

    let is_data = desc_lower.contains("data")
        || desc_lower.contains("database")
        || desc_lower.contains("sql")
        || desc_lower.contains("analytics");

    let is_devops = desc_lower.contains("deploy")
        || desc_lower.contains("docker")
        || desc_lower.contains("kubernetes")
        || desc_lower.contains("ci/cd")
        || desc_lower.contains("infrastructure");

    let is_security = desc_lower.contains("security")
        || desc_lower.contains("vulnerability")
        || desc_lower.contains("penetration")
        || desc_lower.contains("audit");

    let mut prompt = String::new();

    // Build role definition
    prompt.push_str("You are ");

    let mut roles: Vec<&str> = Vec::new();
    if is_coding {
        roles.push("an expert software developer");
    }
    if is_research {
        roles.push("a thorough researcher and analyst");
    }
    if is_testing {
        roles.push("a meticulous QA engineer");
    }
    if is_review {
        roles.push("a detail-oriented code reviewer");
    }
    if is_writing {
        roles.push("a skilled technical writer");
    }
    if is_data {
        roles.push("a data engineering specialist");
    }
    if is_devops {
        roles.push("a DevOps and infrastructure expert");
    }
    if is_security {
        roles.push("a security specialist");
    }

    if roles.is_empty() {
        prompt.push_str("a versatile AI assistant");
    } else if roles.len() == 1 {
        prompt.push_str(roles[0]);
    } else {
        prompt.push_str(&roles[..roles.len() - 1].join(", "));
        prompt.push_str(" and ");
        prompt.push_str(roles[roles.len() - 1]);
    }

    prompt.push_str(".\n\n## Core Responsibilities\n\n");

    // Add specific responsibilities based on detected intents
    if is_coding {
        prompt.push_str("### Software Development\n");
        prompt.push_str("- Write clean, efficient, and well-documented code\n");
        prompt.push_str("- Follow established design patterns and best practices\n");
        prompt.push_str("- Consider edge cases, error handling, and performance\n");
        prompt.push_str("- Use appropriate language idioms and conventions\n\n");
    }

    if is_research {
        prompt.push_str("### Research & Analysis\n");
        prompt.push_str("- Conduct thorough investigation of topics\n");
        prompt.push_str("- Synthesize information from multiple sources\n");
        prompt.push_str("- Provide evidence-based conclusions\n");
        prompt.push_str("- Present findings in a clear, organized manner\n\n");
    }

    if is_testing {
        prompt.push_str("### Quality Assurance\n");
        prompt.push_str("- Design comprehensive test cases and scenarios\n");
        prompt.push_str("- Identify edge cases and potential failure modes\n");
        prompt.push_str("- Verify functionality meets requirements\n");
        prompt.push_str("- Provide detailed test reports and recommendations\n\n");
    }

    if is_review {
        prompt.push_str("### Code Review & Auditing\n");
        prompt.push_str("- Examine code for quality, security, and maintainability\n");
        prompt.push_str("- Identify bugs, anti-patterns, and improvement opportunities\n");
        prompt.push_str("- Provide constructive and actionable feedback\n");
        prompt.push_str("- Suggest best practices and optimizations\n\n");
    }

    if is_writing {
        prompt.push_str("### Documentation & Content\n");
        prompt.push_str("- Create clear, well-structured documentation\n");
        prompt.push_str("- Adapt tone and style for the target audience\n");
        prompt.push_str("- Ensure technical accuracy and completeness\n");
        prompt.push_str("- Format content for maximum readability\n\n");
    }

    if is_data {
        prompt.push_str("### Data Engineering\n");
        prompt.push_str("- Design efficient data models and schemas\n");
        prompt.push_str("- Write optimized queries and data pipelines\n");
        prompt.push_str("- Ensure data integrity and consistency\n");
        prompt.push_str("- Implement proper data validation and cleaning\n\n");
    }

    if is_devops {
        prompt.push_str("### DevOps & Infrastructure\n");
        prompt.push_str("- Design reliable deployment pipelines\n");
        prompt.push_str("- Configure infrastructure as code\n");
        prompt.push_str("- Implement monitoring and alerting\n");
        prompt.push_str("- Ensure high availability and scalability\n\n");
    }

    if is_security {
        prompt.push_str("### Security\n");
        prompt.push_str("- Identify potential security vulnerabilities\n");
        prompt.push_str("- Recommend security best practices\n");
        prompt.push_str("- Review code for common security issues\n");
        prompt.push_str("- Ensure compliance with security standards\n\n");
    }

    // Generic responsibilities if no specific ones detected
    if roles.is_empty() {
        prompt.push_str("### General Assistance\n");
        prompt.push_str("- Understand user requirements thoroughly\n");
        prompt.push_str("- Provide accurate and helpful responses\n");
        prompt.push_str("- Ask clarifying questions when needed\n");
        prompt.push_str("- Deliver high-quality results\n\n");
    }

    // Add communication guidelines
    prompt.push_str("## Communication Style\n\n");
    prompt.push_str("- Be concise yet thorough in explanations\n");
    prompt.push_str("- Use code examples when appropriate\n");
    prompt.push_str("- Acknowledge limitations and uncertainties\n");
    prompt.push_str("- Proactively suggest improvements and alternatives\n\n");

    // Add the user's original description as context
    prompt.push_str("## Task Context\n\n");
    prompt.push_str(&format!("User's description: {}\n", description));

    Ok(prompt)
}
