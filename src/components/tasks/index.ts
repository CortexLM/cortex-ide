// Existing task components
export { TasksPanel } from "./TasksPanel";
export { TaskConfigEditor } from "./TaskConfigEditor";
export { TaskQuickPick } from "./TaskQuickPick";
export { TasksJsonEditor } from "./TasksJsonEditor";
export { TaskRunner } from "./TaskRunner";
export { TaskStatusBarItem as TaskStatusBar } from "./TaskStatusBar";
export { ProblemMatcherSelector as ProblemMatcher } from "./ProblemMatcher";
export { RunConfigDialog } from "./RunConfigDialog";
export { TaskInputDialog } from "./TaskInputDialog";
export { ProblemsPanel } from "./ProblemsPanel";

// New real-time task progress components
export { TaskProgress, type Task, type TaskStatus } from "./TaskProgress";

export { TaskOutputChannel } from "./TaskOutputChannel";
export type { TaskOutputChannelProps } from "./TaskOutputChannel";
