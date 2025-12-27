import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { Project, ExecutionPlan, ExecutionEvent, ApiKeysInput } from './types';

/**
 * Open a folder selection dialog and return the selected path
 */
export async function selectProjectFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select Project Folder',
  });
  return result as string | null;
}

/**
 * Open a file selection dialog for loading a project
 */
export async function selectProjectFile(): Promise<string | null> {
  const result = await open({
    filters: [{ name: 'Needlepoint Project', extensions: ['yaml', 'yml'] }],
    multiple: false,
    title: 'Open Project',
  });
  return result as string | null;
}

/**
 * Load a project from the filesystem
 */
export async function loadProjectFromPath(): Promise<Project | null> {
  const path = await selectProjectFile();
  if (!path) return null;

  return await invoke<Project>('load_project', { path });
}

/**
 * Save a project to the filesystem
 */
export async function saveProjectToPath(project: Project): Promise<void> {
  await invoke('save_project', { project });
}

/**
 * Generate code for a single node
 */
export async function generateNode(
  project: Project,
  nodeId: string,
  apiKey?: string
): Promise<string> {
  return await invoke<string>('generate_node', { project, nodeId, apiKey });
}

/**
 * Preview the prompt that would be sent to the LLM
 */
export async function previewPrompt(
  project: Project,
  nodeId: string
): Promise<string> {
  return await invoke<string>('preview_prompt', { project, nodeId });
}

/**
 * Get the execution plan for a project (for preview)
 */
export async function getExecutionPlan(project: Project): Promise<ExecutionPlan> {
  return await invoke<ExecutionPlan>('get_execution_plan', { project });
}

/**
 * Generate code for all nodes in dependency order
 * Returns the updated project with generated code
 */
export async function generateAll(
  project: Project,
  apiKeys: ApiKeysInput
): Promise<Project> {
  return await invoke<Project>('generate_all', { project, apiKeys });
}

/**
 * Generate code for specific nodes
 * Respects dependency order - will generate dependencies first
 */
export async function generateNodes(
  project: Project,
  nodeIds: string[],
  apiKeys: ApiKeysInput
): Promise<Project> {
  return await invoke<Project>('generate_nodes', { project, nodeIds, apiKeys });
}

/**
 * Listen for execution progress events
 */
export async function onExecutionProgress(
  callback: (event: ExecutionEvent) => void
): Promise<UnlistenFn> {
  return await listen<ExecutionEvent>('execution-progress', (event) => {
    callback(event.payload);
  });
}

// ============================================================================
// File System Operations
// ============================================================================

/**
 * Create a file and its parent directories if they don't exist
 */
export async function createFile(projectPath: string, filePath: string): Promise<void> {
  await invoke('create_file', { projectPath, filePath });
}

/**
 * Write content to a file, creating directories as needed
 */
export async function writeFile(projectPath: string, filePath: string, content: string): Promise<void> {
  await invoke('write_file', { projectPath, filePath, content });
}

/**
 * Soft delete a file (moves to trash)
 * Returns the trash filename for potential restoration
 */
export async function deleteFile(projectPath: string, filePath: string): Promise<string> {
  return await invoke<string>('delete_file', { projectPath, filePath });
}

/**
 * Permanently delete a file (bypasses trash)
 */
export async function deleteFilePermanent(projectPath: string, filePath: string): Promise<void> {
  await invoke('delete_file_permanent', { projectPath, filePath });
}

/**
 * Restore a file from trash
 */
export async function restoreFile(projectPath: string, trashFilename: string, originalPath: string): Promise<void> {
  await invoke('restore_file', { projectPath, trashFilename, originalPath });
}

/**
 * List files in trash
 */
export async function listTrash(projectPath: string): Promise<string[]> {
  return await invoke<string[]>('list_trash', { projectPath });
}

/**
 * Empty the trash (permanently delete all trashed files)
 * Returns the number of files deleted
 */
export async function emptyTrash(projectPath: string): Promise<number> {
  return await invoke<number>('empty_trash', { projectPath });
}

/**
 * Rename/move a file
 */
export async function renameFile(projectPath: string, oldPath: string, newPath: string): Promise<void> {
  await invoke('rename_file', { projectPath, oldPath, newPath });
}

/**
 * Check if a file exists
 */
export async function fileExists(projectPath: string, filePath: string): Promise<boolean> {
  return await invoke<boolean>('file_exists', { projectPath, filePath });
}

/**
 * Create a directory and its parents
 */
export async function createDirectory(projectPath: string, dirPath: string): Promise<void> {
  await invoke('create_directory', { projectPath, dirPath });
}

// ============================================================================
// API & Agent Integration
// ============================================================================

/**
 * Get the HTTP API port that Needlepoint is running on
 */
export async function getApiPort(): Promise<number | null> {
  return await invoke<number | null>('get_api_port');
}

// ============================================================================
// Path Validation (Frontend)
// ============================================================================

/**
 * Validate a file path on the frontend before sending to backend
 * Returns an error message if invalid, or null if valid
 */
export function validateFilePath(filePath: string): string | null {
  if (!filePath || filePath.trim() === '') {
    return 'File path cannot be empty';
  }

  // Check for null bytes
  if (filePath.includes('\0')) {
    return 'File path contains invalid characters';
  }

  // Check for absolute paths
  if (filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) {
    return 'Absolute paths are not allowed';
  }

  // Check for directory traversal
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..')) {
    return 'Path cannot contain ".." (directory traversal not allowed)';
  }

  // Check for invalid characters (Windows)
  if (/[<>:"|?*]/.test(filePath)) {
    return 'Path contains invalid characters';
  }

  return null;
}
