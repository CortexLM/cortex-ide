/**
 * Authentication Types
 *
 * Type definitions for the Authentication API, including providers,
 * sessions, OAuth flows, and related configuration options.
 * Compatible with VS Code Authentication API.
 */

import type { Disposable } from "./ssh";

// ============================================================================
// Event Type (local definition to avoid circular imports)
// ============================================================================

/**
 * Represents an event that can be subscribed to.
 * @template T The type of the event data
 */
type Event<T> = (listener: (e: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;

// ============================================================================
// Authentication Provider
// ============================================================================

/**
 * A provider for performing authentication.
 * Authentication providers are responsible for managing authentication sessions
 * and handling authentication requests.
 */
interface AuthenticationProvider {
  /**
   * An event that fires when the set of sessions changes for this provider.
   */
  onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;

  /**
   * Get a list of sessions.
   * @param scopes An optional list of scopes. If provided, the sessions returned
   *               should match all scopes requested.
   * @returns A promise that resolves to an array of authentication sessions.
   */
  getSessions(scopes?: readonly string[]): Promise<readonly AuthenticationSession[]>;

  /**
   * Prompts the user to login.
   * If login is successful, the provider should fire the `onDidChangeSessions` event
   * with the `added` field containing the newly created session.
   * @param scopes A list of scopes the session should be created with.
   * @returns A promise that resolves to an authentication session.
   */
  createSession(scopes: readonly string[]): Promise<AuthenticationSession>;

  /**
   * Removes the session corresponding to the session id.
   * If the session is removed, the provider should fire the `onDidChangeSessions` event
   * with the `removed` field containing the removed session.
   * @param sessionId The id of the session to remove.
   */
  removeSession(sessionId: string): Promise<void>;
}

/**
 * Event fired when authentication sessions for a provider change.
 */
interface AuthenticationProviderAuthenticationSessionsChangeEvent {
  /** Sessions that were added */
  added?: readonly AuthenticationSession[];
  /** Sessions that were removed */
  removed?: readonly AuthenticationSession[];
  /** Sessions whose data changed */
  changed?: readonly AuthenticationSession[];
}

// ============================================================================
// Authentication Session
// ============================================================================

/**
 * Represents an authentication session.
 * Contains the credentials and account information needed for authentication.
 */
interface AuthenticationSession {
  /**
   * The unique identifier of this session.
   * This is used to correlate sessions across different parts of the application.
   */
  id: string;

  /**
   * The access token for this session.
   * This is the credential used to authenticate API requests.
   */
  accessToken: string;

  /**
   * The account associated with this session.
   * Contains the user's account information.
   */
  account: AuthenticationSessionAccountInformation;

  /**
   * The permissions granted for this session.
   * Each scope represents a specific permission or access level.
   */
  scopes: readonly string[];
}

/**
 * Information about an account associated with an authentication session.
 */
interface AuthenticationSessionAccountInformation {
  /**
   * A unique identifier for the account.
   * This could be an email, username, or opaque ID depending on the provider.
   */
  id: string;

  /**
   * A human-readable label for the account.
   * Displayed in the UI to help users identify the account.
   */
  label: string;
}

// ============================================================================
// Authentication Provider Information
// ============================================================================

/**
 * Basic information about an authentication provider.
 */
interface AuthenticationProviderInformation {
  /**
   * The unique identifier for the provider.
   * This is used to reference the provider in API calls.
   */
  id: string;

  /**
   * A human-readable label for the provider.
   * Displayed in the UI to help users identify the provider.
   */
  label: string;
}

// ============================================================================
// Get Session Options
// ============================================================================

/**
 * Options for getting an authentication session.
 */
interface AuthenticationGetSessionOptions {
  /**
   * Whether to clear the session preference.
   * If true, the user will be prompted to choose an account again.
   */
  clearSessionPreference?: boolean;

  /**
   * Whether to create a session if none exists.
   * If true and no session is found, the user will be prompted to sign in.
   */
  createIfNone?: boolean;

  /**
   * Whether to force creating a new session.
   * If true, a new session will be created even if one already exists.
   */
  forceNewSession?: boolean | AuthenticationForceNewSessionOptions;

  /**
   * Whether to silently get the session.
   * If true, no UI will be shown to the user.
   * Only existing sessions that match the scopes will be returned.
   */
  silent?: boolean;
}

/**
 * Options for forcing a new authentication session.
 */
interface AuthenticationForceNewSessionOptions {
  /**
   * A detailed message explaining why a new session is being requested.
   * This will be displayed to the user.
   */
  detail?: string;
}

// ============================================================================
// Authentication Session Change Event
// ============================================================================

/**
 * Event fired when authentication sessions change.
 */
interface AuthenticationSessionsChangeEvent {
  /**
   * The authentication provider for which the sessions changed.
   */
  provider: AuthenticationProviderInformation;
}

// ============================================================================
// Authentication Provider Options
// ============================================================================

/**
 * Options for registering an authentication provider.
 */
interface AuthenticationProviderOptions {
  /**
   * Whether the provider supports having multiple accounts.
   * If true, users can sign in with multiple accounts simultaneously.
   */
  supportsMultipleAccounts?: boolean;
}

// ============================================================================
// Built-in Providers
// ============================================================================

/**
 * Built-in authentication provider identifiers.
 * These are providers that are built into the application.
 */
type BuiltinAuthenticationProvider = "github" | "microsoft";

// ============================================================================
// Authentication API
// ============================================================================

/**
 * The Authentication API interface.
 * Provides methods for working with authentication sessions and providers.
 */
interface AuthenticationAPI {
  /**
   * Get an authentication session matching the provided scopes.
   *
   * @param providerId The id of the authentication provider to use.
   * @param scopes A list of scopes the session should have.
   * @param options Additional options for getting the session.
   * @returns A promise that resolves to an authentication session, or undefined.
   */
  getSession(
    providerId: string,
    scopes: readonly string[],
    options?: AuthenticationGetSessionOptions
  ): Promise<AuthenticationSession | undefined>;

  /**
   * Register an authentication provider.
   *
   * @param id A unique identifier for the provider.
   * @param label A human-readable label for the provider.
   * @param provider The authentication provider implementation.
   * @param options Additional options for the provider.
   * @returns A disposable that unregisters the provider when disposed.
   */
  registerAuthenticationProvider(
    id: string,
    label: string,
    provider: AuthenticationProvider,
    options?: AuthenticationProviderOptions
  ): Disposable;

  /**
   * An event that fires when the set of sessions of any provider changes.
   */
  onDidChangeSessions: Event<AuthenticationSessionsChangeEvent>;
}

// ============================================================================
// OAuth Flow Types (Internal)
// ============================================================================

/**
 * Configuration for an OAuth authentication flow.
 * Used internally to manage OAuth-based authentication.
 */
interface OAuthConfig {
  /**
   * The OAuth client ID.
   * Obtained from the OAuth provider during app registration.
   */
  clientId: string;

  /**
   * The OAuth client secret.
   * Optional for public clients using PKCE.
   */
  clientSecret?: string;

  /**
   * The authorization endpoint URL.
   * Where users are redirected to authenticate.
   */
  authorizationEndpoint: string;

  /**
   * The token endpoint URL.
   * Where authorization codes are exchanged for access tokens.
   */
  tokenEndpoint: string;

  /**
   * The redirect URI for the OAuth callback.
   * Must match the registered redirect URI.
   */
  redirectUri: string;

  /**
   * The scopes to request.
   * Each scope represents a specific permission.
   */
  scope: string[];

  /**
   * Additional parameters to include in the authorization request.
   */
  extraParams?: Record<string, string>;
}

/**
 * State information for an in-progress OAuth flow.
 */
interface OAuthState {
  /**
   * The state parameter for CSRF protection.
   * Should be validated when the callback is received.
   */
  state: string;

  /**
   * The PKCE code verifier.
   * Used to prove possession of the authorization code.
   */
  codeVerifier?: string;

  /**
   * The redirect URI used for this flow.
   */
  redirectUri: string;

  /**
   * The scopes requested for this flow.
   */
  scopes: string[];
}

/**
 * Response from an OAuth token endpoint.
 */
interface OAuthTokenResponse {
  /**
   * The access token.
   * Used to authenticate API requests.
   */
  access_token: string;

  /**
   * The type of token.
   * Usually "Bearer".
   */
  token_type: string;

  /**
   * The lifetime of the access token in seconds.
   * After this time, the token should be refreshed.
   */
  expires_in?: number;

  /**
   * The refresh token.
   * Used to obtain new access tokens without user interaction.
   */
  refresh_token?: string;

  /**
   * The scopes granted.
   * May differ from the scopes requested.
   */
  scope?: string;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  Event,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  AuthenticationProviderInformation,
  AuthenticationGetSessionOptions,
  AuthenticationForceNewSessionOptions,
  AuthenticationSessionsChangeEvent,
  AuthenticationProviderOptions,
  BuiltinAuthenticationProvider,
  AuthenticationAPI,
  OAuthConfig,
  OAuthState,
  OAuthTokenResponse,
};
