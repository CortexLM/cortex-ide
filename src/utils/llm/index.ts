/**
 * LLM Module Index
 * Exports all LLM provider types and implementations
 */

// Types
export * from "./types";

// Base Provider
export { BaseLLMProvider } from "./LLMProvider";

// Provider Implementations
export { AnthropicProvider } from "./AnthropicProvider";
export { OpenAIProvider } from "./OpenAIProvider";
export { GoogleAIProvider } from "./GoogleAIProvider";
export { MistralProvider } from "./MistralProvider";
export { DeepSeekProvider } from "./DeepSeekProvider";
export { OpenRouterProvider } from "./OpenRouterProvider";

// Provider Factory
import { AnthropicProvider } from "./AnthropicProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GoogleAIProvider } from "./GoogleAIProvider";
import { MistralProvider } from "./MistralProvider";
import { DeepSeekProvider } from "./DeepSeekProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import type { LLMProvider, LLMProviderType, LLMProviderConfig } from "./types";

/**
 * Create a provider instance by type
 */
export function createProvider(type: LLMProviderType, config?: LLMProviderConfig): LLMProvider {
  let provider: LLMProvider;

  switch (type) {
    case "anthropic":
      provider = new AnthropicProvider();
      break;
    case "openai":
      provider = new OpenAIProvider();
      break;
    case "google":
      provider = new GoogleAIProvider();
      break;
    case "mistral":
      provider = new MistralProvider();
      break;
    case "deepseek":
      provider = new DeepSeekProvider();
      break;
    case "openrouter":
      provider = new OpenRouterProvider();
      break;
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }

  if (config) {
    provider.configure(config);
  }

  return provider;
}

/**
 * Get all available provider types
 */
export function getProviderTypes(): LLMProviderType[] {
  return ["anthropic", "openai", "google", "mistral", "deepseek", "openrouter"];
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(type: LLMProviderType): string {
  const names: Record<LLMProviderType, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google AI",
    mistral: "Mistral AI",
    deepseek: "DeepSeek",
    openrouter: "OpenRouter",
  };
  return names[type];
}

/**
 * Check if provider requires API key
 */
export function providerRequiresApiKey(_type: LLMProviderType): boolean {
  return true;
}
