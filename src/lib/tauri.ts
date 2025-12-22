import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Project } from './types';

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
  nodeId: string
): Promise<string> {
  return await invoke<string>('generate_node', { project, nodeId });
}

/**
 * Generate code for all nodes in dependency order
 */
export async function generateAll(project: Project): Promise<void> {
  await invoke('generate_all', { project });
}

/**
 * Validate generated code for a node
 */
export async function validateNode(
  project: Project,
  nodeId: string
): Promise<{ valid: boolean; errors: string[] }> {
  return await invoke('validate_node', { project, nodeId });
}
