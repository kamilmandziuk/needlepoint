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
