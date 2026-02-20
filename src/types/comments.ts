/**
 * Comments API Types
 *
 * Type definitions for the code review comments system.
 * Provides interfaces for comment controllers, threads, and reactions
 * following VS Code's Comments API pattern.
 */

// ============================================================================
// Forward Type References
// ============================================================================

/**
 * URI type for resource identification.
 * Using string representation for simplicity.
 */
export type Uri = string;

/**
 * Range in a document (0-based line numbers).
 */
export interface Range {
  /** Start line (0-based) */
  startLine: number;
  /** Start character (0-based) */
  startCharacter: number;
  /** End line (0-based) */
  endLine: number;
  /** End character (0-based) */
  endCharacter: number;
}

/**
 * Markdown string for rich text content.
 */
export interface MarkdownString {
  /** The markdown source */
  value: string;
  /** Whether the markdown is trusted (can contain scripts) */
  isTrusted?: boolean;
  /** Whether the markdown supports HTML tags */
  supportHtml?: boolean;
  /** Base URI for relative links */
  baseUri?: Uri;
}

/**
 * Simplified TextDocument reference.
 */
export interface TextDocument {
  /** The URI of the document */
  uri: Uri;
  /** The file path */
  fileName: string;
  /** The language identifier */
  languageId: string;
  /** The version number */
  version: number;
}

/**
 * Cancellation token for async operations.
 */
export interface CancellationToken {
  /** Whether cancellation has been requested */
  isCancellationRequested: boolean;
  /** Event fired when cancellation is requested */
  onCancellationRequested: (listener: () => void) => { dispose(): void };
}

// ============================================================================
// Comment Options
// ============================================================================

/**
 * Options for comment input.
 */
export interface CommentOptions {
  /** Prompt text shown above the comment input */
  prompt?: string;
  /** Placeholder text in the comment input */
  placeHolder?: string;
}

// ============================================================================
// Comment Author
// ============================================================================

/**
 * Information about the author of a comment.
 */
export interface CommentAuthorInformation {
  /** Display name of the author */
  name: string;
  /** Avatar icon path (single or theme-aware) */
  iconPath?: Uri | { light: Uri; dark: Uri };
}

// ============================================================================
// Comment Reaction
// ============================================================================

/**
 * Represents a reaction to a comment (like, heart, etc.).
 */
export interface CommentReaction {
  /** Label for the reaction (e.g., emoji or text) */
  label: string;
  /** Icon path for the reaction */
  iconPath: string | Uri;
  /** Number of users who reacted */
  count: number;
  /** Whether the current user has reacted */
  authorHasReacted: boolean;
}

// ============================================================================
// Comment Mode Enum
// ============================================================================

/**
 * Mode of a comment (editing or preview).
 */
export enum CommentMode {
  /** Comment is being edited */
  Editing = 0,
  /** Comment is in preview/read mode */
  Preview = 1,
}

// ============================================================================
// Comment Interface
// ============================================================================

/**
 * Represents a single comment in a thread.
 */
export interface Comment {
  /** The comment body (plain text or markdown) */
  body: string | MarkdownString;
  /** Current mode of the comment */
  mode: CommentMode;
  /** Author information */
  author: CommentAuthorInformation;
  /** Optional context value for command enablement */
  contextValue?: string;
  /** Reactions attached to this comment */
  reactions?: CommentReaction[];
  /** Optional label for the comment */
  label?: string;
  /** Timestamp when the comment was created */
  timestamp?: Date;
}

// ============================================================================
// Comment Thread State Enums
// ============================================================================

/**
 * Collapsible state of a comment thread.
 */
export enum CommentThreadCollapsibleState {
  /** Thread is collapsed */
  Collapsed = 0,
  /** Thread is expanded */
  Expanded = 1,
}

/**
 * Resolution state of a comment thread.
 */
export enum CommentThreadState {
  /** Thread is unresolved */
  Unresolved = 0,
  /** Thread has been resolved */
  Resolved = 1,
}

// ============================================================================
// Comment Thread Interface
// ============================================================================

/**
 * Represents a thread of comments attached to a specific location in code.
 */
export interface CommentThread {
  /** The URI of the document the thread is attached to */
  uri: Uri;
  /** The range in the document */
  range: Range;
  /** Array of comments in the thread */
  comments: Comment[];
  /** Whether the thread is collapsed or expanded */
  collapsibleState: CommentThreadCollapsibleState;
  /** Whether replies can be added to this thread */
  canReply: boolean;
  /** Optional context value for command enablement */
  contextValue?: string;
  /** Optional label displayed for the thread */
  label?: string;
  /** Resolution state of the thread */
  state?: CommentThreadState;
  /** Dispose of the comment thread */
  dispose(): void;
}

// ============================================================================
// Commenting Range Provider
// ============================================================================

/**
 * Provides ranges where comments can be added.
 */
export interface CommentingRangeProvider {
  /**
   * Provides the ranges in a document where new comments can be created.
   * @param document The document to provide ranges for
   * @param token Cancellation token
   * @returns Promise resolving to an array of ranges
   */
  provideCommentingRanges(
    document: TextDocument,
    token: CancellationToken
  ): Promise<Range[]>;
}

// ============================================================================
// Comment Controller Interface
// ============================================================================

/**
 * Controller for managing comment threads in a document.
 */
export interface CommentController {
  /** Unique identifier for the controller */
  id: string;
  /** Human-readable label for the controller */
  label: string;
  /** Options for comment input */
  options?: CommentOptions;
  /** Provider for determining where comments can be added */
  commentingRangeProvider?: CommentingRangeProvider;
  /**
   * Creates a new comment thread at the specified location.
   * @param uri The document URI
   * @param range The range in the document
   * @param comments Initial comments in the thread
   * @returns The created comment thread
   */
  createCommentThread(uri: Uri, range: Range, comments: Comment[]): CommentThread;
  /** Dispose of the controller and all its threads */
  dispose(): void;
}

// ============================================================================
// Comment Reply
// ============================================================================

/**
 * Represents a reply to a comment thread.
 */
export interface CommentReply {
  /** The thread being replied to */
  thread: CommentThread;
  /** The reply text */
  text: string;
}

// ============================================================================
// Comment Events
// ============================================================================

/**
 * Event fired when comment threads change.
 */
export interface CommentThreadChangedEvent {
  /** Newly added comment threads */
  added: CommentThread[];
  /** Removed comment threads */
  removed: CommentThread[];
  /** Modified comment threads */
  changed: CommentThread[];
}

// ============================================================================
// Additional Types for Implementation
// ============================================================================

/**
 * Configuration for creating a comment controller.
 */
export interface CommentControllerConfig {
  /** Unique identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Comment input options */
  options?: CommentOptions;
}

/**
 * Data for creating a new comment.
 */
export interface CreateCommentData {
  /** Comment body */
  body: string;
  /** Author name */
  authorName: string;
  /** Author icon path */
  authorIconPath?: Uri;
}

/**
 * Data for creating a new comment thread.
 */
export interface CreateCommentThreadData {
  /** Document URI */
  uri: Uri;
  /** Range in the document */
  range: Range;
  /** Initial comments */
  comments: CreateCommentData[];
}

/**
 * Serialized comment for persistence.
 */
export interface SerializedComment {
  /** Comment body as string */
  body: string;
  /** Whether body is markdown */
  isMarkdown: boolean;
  /** Comment mode */
  mode: CommentMode;
  /** Author name */
  authorName: string;
  /** Author icon path */
  authorIconPath?: string;
  /** Context value */
  contextValue?: string;
  /** Reactions */
  reactions?: CommentReaction[];
  /** Label */
  label?: string;
  /** Timestamp as ISO string */
  timestamp?: string;
}

/**
 * Serialized comment thread for persistence.
 */
export interface SerializedCommentThread {
  /** Thread ID */
  id: string;
  /** Document URI */
  uri: string;
  /** Range */
  range: Range;
  /** Serialized comments */
  comments: SerializedComment[];
  /** Collapsible state */
  collapsibleState: CommentThreadCollapsibleState;
  /** Can reply flag */
  canReply: boolean;
  /** Context value */
  contextValue?: string;
  /** Label */
  label?: string;
  /** Thread state */
  state?: CommentThreadState;
}


