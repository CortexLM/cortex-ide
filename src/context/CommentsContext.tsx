import { createContext, useContext, ParentProps, createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

export type ReactionType = "👍" | "👎" | "❤️" | "🎉" | "😄" | "😕" | "🚀" | "👀";

export interface CommentReaction {
  emoji: ReactionType;
  userIds: string[];
}

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  threadId: string;
  author: CommentAuthor;
  content: string;
  createdAt: number;
  updatedAt: number;
  reactions: CommentReaction[];
  isEdited: boolean;
}

export interface CommentThread {
  id: string;
  filePath: string;
  lineNumber: number;
  lineContent: string;
  comments: Comment[];
  isResolved: boolean;
  resolvedBy?: CommentAuthor;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CommentLocation {
  filePath: string;
  lineNumber: number;
}

export type CommentFilter = "all" | "resolved" | "unresolved";

interface CommentsState {
  threads: CommentThread[];
  currentUser: CommentAuthor;
  activeThreadId: string | null;
  filter: CommentFilter;
  fileFilter: string | null;
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface CommentsContextValue {
  state: CommentsState;
  
  // Thread management
  createThread: (location: CommentLocation, lineContent: string, initialComment: string) => string;
  deleteThread: (threadId: string) => void;
  resolveThread: (threadId: string) => void;
  unresolveThread: (threadId: string) => void;
  
  // Comment management
  addComment: (threadId: string, content: string) => string;
  editComment: (threadId: string, commentId: string, newContent: string) => void;
  deleteComment: (threadId: string, commentId: string) => void;
  
  // Reaction management
  toggleReaction: (threadId: string, commentId: string, emoji: ReactionType) => void;
  
  // Navigation and filtering
  setActiveThread: (threadId: string | null) => void;
  setFilter: (filter: CommentFilter) => void;
  setFileFilter: (filePath: string | null) => void;
  
  // Queries
  getThreadsForFile: (filePath: string) => CommentThread[];
  getThreadByLocation: (filePath: string, lineNumber: number) => CommentThread | undefined;
  getThreadById: (threadId: string) => CommentThread | undefined;
  filteredThreads: () => CommentThread[];
  threadsByFile: () => Map<string, CommentThread[]>;
  unresolvedCount: () => number;
  totalCount: () => number;
  
  // User management
  setCurrentUser: (user: CommentAuthor) => void;
}

// ============================================================================
// Context
// ============================================================================

const CommentsContext = createContext<CommentsContextValue>();

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Provider
// ============================================================================

export function CommentsProvider(props: ParentProps) {
  const [state, setState] = createStore<CommentsState>({
    threads: [],
    currentUser: {
      id: "current-user",
      name: "Current User",
    },
    activeThreadId: null,
    filter: "all",
    fileFilter: null,
  });

  // ============================================================================
  // Thread Management
  // ============================================================================

  const createThread = (
    location: CommentLocation,
    lineContent: string,
    initialComment: string
  ): string => {
    const threadId = generateId();
    const commentId = generateId();
    const now = Date.now();

    const newComment: Comment = {
      id: commentId,
      threadId,
      author: { ...state.currentUser },
      content: initialComment,
      createdAt: now,
      updatedAt: now,
      reactions: [],
      isEdited: false,
    };

    const newThread: CommentThread = {
      id: threadId,
      filePath: location.filePath,
      lineNumber: location.lineNumber,
      lineContent,
      comments: [newComment],
      isResolved: false,
      createdAt: now,
      updatedAt: now,
    };

    setState("threads", (threads) => [...threads, newThread]);
    setState("activeThreadId", threadId);

    return threadId;
  };

  const deleteThread = (threadId: string) => {
    setState("threads", (threads) => threads.filter((t) => t.id !== threadId));
    
    if (state.activeThreadId === threadId) {
      setState("activeThreadId", null);
    }
  };

  const resolveThread = (threadId: string) => {
    const now = Date.now();
    
    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        thread.isResolved = true;
        thread.resolvedBy = { ...state.currentUser };
        thread.resolvedAt = now;
        thread.updatedAt = now;
      })
    );
  };

  const unresolveThread = (threadId: string) => {
    const now = Date.now();
    
    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        thread.isResolved = false;
        thread.resolvedBy = undefined;
        thread.resolvedAt = undefined;
        thread.updatedAt = now;
      })
    );
  };

  // ============================================================================
  // Comment Management
  // ============================================================================

  const addComment = (threadId: string, content: string): string => {
    const commentId = generateId();
    const now = Date.now();

    const newComment: Comment = {
      id: commentId,
      threadId,
      author: { ...state.currentUser },
      content,
      createdAt: now,
      updatedAt: now,
      reactions: [],
      isEdited: false,
    };

    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        thread.comments.push(newComment);
        thread.updatedAt = now;
      })
    );

    return commentId;
  };

  const editComment = (threadId: string, commentId: string, newContent: string) => {
    const now = Date.now();

    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        const comment = thread.comments.find((c) => c.id === commentId);
        if (comment && comment.author.id === state.currentUser.id) {
          comment.content = newContent;
          comment.updatedAt = now;
          comment.isEdited = true;
        }
        thread.updatedAt = now;
      })
    );
  };

  const deleteComment = (threadId: string, commentId: string) => {
    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) return;

    // If this is the only comment in the thread, delete the entire thread
    if (thread.comments.length === 1 && thread.comments[0].id === commentId) {
      deleteThread(threadId);
      return;
    }

    const now = Date.now();

    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        const idx = thread.comments.findIndex((c) => c.id === commentId);
        if (idx !== -1 && thread.comments[idx].author.id === state.currentUser.id) {
          thread.comments.splice(idx, 1);
          thread.updatedAt = now;
        }
      })
    );
  };

  // ============================================================================
  // Reaction Management
  // ============================================================================

  const toggleReaction = (threadId: string, commentId: string, emoji: ReactionType) => {
    setState(
      "threads",
      (t) => t.id === threadId,
      produce((thread) => {
        const comment = thread.comments.find((c) => c.id === commentId);
        if (!comment) return;

        const existingReaction = comment.reactions.find((r) => r.emoji === emoji);
        const userId = state.currentUser.id;

        if (existingReaction) {
          const userIndex = existingReaction.userIds.indexOf(userId);
          if (userIndex !== -1) {
            // Remove user's reaction
            existingReaction.userIds.splice(userIndex, 1);
            // Remove reaction if no users left
            if (existingReaction.userIds.length === 0) {
              const reactionIndex = comment.reactions.indexOf(existingReaction);
              comment.reactions.splice(reactionIndex, 1);
            }
          } else {
            // Add user's reaction
            existingReaction.userIds.push(userId);
          }
        } else {
          // Create new reaction
          comment.reactions.push({
            emoji,
            userIds: [userId],
          });
        }

        thread.updatedAt = Date.now();
      })
    );
  };

  // ============================================================================
  // Navigation and Filtering
  // ============================================================================

  const setActiveThread = (threadId: string | null) => {
    setState("activeThreadId", threadId);
  };

  const setFilter = (filter: CommentFilter) => {
    setState("filter", filter);
  };

  const setFileFilter = (filePath: string | null) => {
    setState("fileFilter", filePath);
  };

  // ============================================================================
  // Query Functions
  // ============================================================================

  const getThreadsForFile = (filePath: string): CommentThread[] => {
    return state.threads.filter((t) => t.filePath === filePath);
  };

  const getThreadByLocation = (
    filePath: string,
    lineNumber: number
  ): CommentThread | undefined => {
    return state.threads.find(
      (t) => t.filePath === filePath && t.lineNumber === lineNumber
    );
  };

  const getThreadById = (threadId: string): CommentThread | undefined => {
    return state.threads.find((t) => t.id === threadId);
  };

  const filteredThreads = createMemo((): CommentThread[] => {
    let result = [...state.threads];

    // Apply resolved/unresolved filter
    if (state.filter === "resolved") {
      result = result.filter((t) => t.isResolved);
    } else if (state.filter === "unresolved") {
      result = result.filter((t) => !t.isResolved);
    }

    // Apply file filter
    if (state.fileFilter) {
      result = result.filter((t) => t.filePath === state.fileFilter);
    }

    // Sort by creation date (newest first)
    result.sort((a, b) => b.createdAt - a.createdAt);

    return result;
  });

  const threadsByFile = createMemo((): Map<string, CommentThread[]> => {
    const threads = filteredThreads();
    const result = new Map<string, CommentThread[]>();

    for (const thread of threads) {
      const existing = result.get(thread.filePath);
      if (existing) {
        existing.push(thread);
      } else {
        result.set(thread.filePath, [thread]);
      }
    }

    // Sort threads within each file by line number
    for (const threads of result.values()) {
      threads.sort((a, b) => a.lineNumber - b.lineNumber);
    }

    return result;
  });

  const unresolvedCount = createMemo((): number => {
    return state.threads.filter((t) => !t.isResolved).length;
  });

  const totalCount = createMemo((): number => {
    return state.threads.length;
  });

  // ============================================================================
  // User Management
  // ============================================================================

  const setCurrentUser = (user: CommentAuthor) => {
    setState("currentUser", user);
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: CommentsContextValue = {
    state,
    createThread,
    deleteThread,
    resolveThread,
    unresolveThread,
    addComment,
    editComment,
    deleteComment,
    toggleReaction,
    setActiveThread,
    setFilter,
    setFileFilter,
    getThreadsForFile,
    getThreadByLocation,
    getThreadById,
    filteredThreads,
    threadsByFile,
    unresolvedCount,
    totalCount,
    setCurrentUser,
  };

  return (
    <CommentsContext.Provider value={contextValue}>
      {props.children}
    </CommentsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useComments(): CommentsContextValue {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error("useComments must be used within CommentsProvider");
  }
  return context;
}
