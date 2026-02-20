/**
 * =============================================================================
 * AGENT FACTORY DIALOGS - Public Exports
 * =============================================================================
 * 
 * This module exports all dialog components for the Agent Factory visual
 * workflow builder. These dialogs provide modal interfaces for template
 * selection, import/export, version management, approvals, and workflow
 * selection.
 * 
 * =============================================================================
 */

// Template Gallery - Pre-built workflow templates
export { TemplateGallery } from "./TemplateGallery";
export type {
  TemplateGalleryProps,
  WorkflowTemplate,
  TemplateCategory,
  TemplateComplexity,
} from "./TemplateGallery";

// Import/Export Dialog - Workflow import and export
export { ImportExportDialog } from "./ImportExportDialog";
export type {
  ImportExportDialogProps,
  ExportFormat,
  ConflictResolution,
  ImportExportHistoryEntry,
  WorkflowPreview,
} from "./ImportExportDialog";

// Version History - Workflow version management
export { VersionHistory } from "./VersionHistory";
export type {
  VersionHistoryProps,
  WorkflowVersion,
  VersionChange,
} from "./VersionHistory";

// Approval Dialog - Single approval request modal
export { ApprovalDialog } from "./ApprovalDialog";
export type {
  ApprovalDialogProps,
  ApprovalRequestDetails,
  ApprovalContext,
  FileWriteDetails,
  BashCommandDetails,
  RiskLevel as ApprovalRiskLevel,
  ActionType,
} from "./ApprovalDialog";

// Workflow List Dialog - Select or manage workflows
export { WorkflowListDialog } from "./WorkflowListDialog";
export type {
  WorkflowListDialogProps,
  WorkflowSummary,
  WorkflowPreviewData,
  SortOption,
  ViewMode,
} from "./WorkflowListDialog";
