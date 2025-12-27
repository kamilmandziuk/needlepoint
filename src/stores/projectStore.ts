import { create } from 'zustand';
import type {
  Project,
  CodeNode,
  CodeEdge,
} from '../lib/types';
import { loadProjectFromPath, saveProjectToPath, selectProjectFolder, createFile, writeFile, deleteFile, renameFile, restoreFile } from '../lib/tauri';
import { useToastStore } from './toastStore';
import { useUndoStore, type DeletedNodeInfo } from './undoStore';

/**
 * Check if a file path already exists in the project (excluding a specific node)
 */
function isPathDuplicate(nodes: CodeNode[], filePath: string, excludeNodeId?: string): boolean {
  return nodes.some(
    (node) => node.filePath === filePath && node.id !== excludeNodeId
  );
}

/**
 * Generate a unique node name by incrementing a suffix
 */
function generateUniqueName(nodes: CodeNode[], baseName: string): string {
  const existingNames = new Set(nodes.map((n) => n.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 1;
  while (existingNames.has(`${baseName}_${counter}`)) {
    counter++;
  }

  return `${baseName}_${counter}`;
}

/**
 * Generate a unique file path by incrementing a suffix
 */
function generateUniqueFilePath(nodes: CodeNode[], basePath: string): string {
  const existingPaths = new Set(nodes.map((n) => n.filePath));

  if (!existingPaths.has(basePath)) {
    return basePath;
  }

  // Split path into directory, name, and extension
  const lastSlash = basePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? basePath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? basePath.slice(lastSlash + 1) : basePath;

  const lastDot = filename.lastIndexOf('.');
  const name = lastDot >= 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot >= 0 ? filename.slice(lastDot) : '';

  let counter = 1;
  while (existingPaths.has(`${dir}${name}-${counter}${ext}`)) {
    counter++;
  }

  return `${dir}${name}-${counter}${ext}`;
}

// Check if adding an edge would create a cycle using DFS
function wouldCreateCycle(
  nodes: CodeNode[],
  edges: CodeEdge[],
  source: string,
  target: string
): boolean {
  // Build adjacency list including the new edge
  const adjacency = new Map<string, string[]>();

  // Initialize adjacency list for all nodes
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  // Add existing edges
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (targets) {
      targets.push(edge.target);
    }
  }

  // Add the proposed new edge
  const sourceTargets = adjacency.get(source);
  if (sourceTargets) {
    sourceTargets.push(target);
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false; // Already processed, no cycle from here
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check for cycles starting from any node
  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      return true;
    }
  }

  return false;
}

interface ProjectState {
  project: Project | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProject: (project: Project | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  createProject: () => Promise<void>;
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  addNode: (node: Omit<CodeNode, 'id'>) => void;
  updateNode: (id: string, updates: Partial<CodeNode>) => void;
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;
  restoreDeletedNodes: (deletedNodes: DeletedNodeInfo[]) => Promise<void>;
  reDeleteNodes: (deletedNodes: DeletedNodeInfo[]) => Promise<void>;
  addEdge: (edge: Omit<CodeEdge, 'id'>) => { success: boolean; error?: string };
  updateEdge: (id: string, updates: Partial<CodeEdge>) => void;
  deleteEdge: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  isLoading: false,
  error: null,

  setProject: (project) => set({ project }),

  setSelectedNodes: (nodeIds) => set({ selectedNodeIds: nodeIds, selectedEdgeId: null }),

  setSelectedEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeIds: [] }),

  createProject: async () => {
    try {
      const path = await selectProjectFolder();
      if (!path) return;

      const newProject: Project = {
        manifest: {
          name: 'New Project',
          version: '0.1.0',
          defaultLLM: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
          },
        },
        nodes: [],
        edges: [],
        projectPath: path,
      };

      set({ project: newProject, selectedNodeIds: [], error: null });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadProject: async () => {
    set({ isLoading: true, error: null });
    try {
      const project = await loadProjectFromPath();
      if (project) {
        set({ project, selectedNodeIds: [] });
      }
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  saveProject: async () => {
    const { project } = get();
    if (!project) return;

    set({ isLoading: true, error: null });
    try {
      await saveProjectToPath(project);
      useToastStore.getState().addToast('Project saved', 'success');
    } catch (error) {
      set({ error: String(error) });
      useToastStore.getState().addToast('Failed to save project', 'error');
    } finally {
      set({ isLoading: false });
    }
  },

  addNode: (nodeData) => {
    const { project } = get();
    if (!project) return;

    // Generate unique name and file path to avoid duplicates
    const uniqueName = generateUniqueName(project.nodes, nodeData.name);
    const uniqueFilePath = generateUniqueFilePath(project.nodes, nodeData.filePath);

    const newNode: CodeNode = {
      ...nodeData,
      name: uniqueName,
      filePath: uniqueFilePath,
      id: crypto.randomUUID(),
    };

    set({
      project: {
        ...project,
        nodes: [...project.nodes, newNode],
      },
    });

    // Create the file on disk (fire and forget)
    createFile(project.projectPath, newNode.filePath).catch((err) => {
      console.error('Failed to create file:', err);
      useToastStore.getState().addToast(`Failed to create file: ${newNode.filePath}`, 'error');
    });
  },

  updateNode: (id, updates) => {
    const { project } = get();
    if (!project) return;

    const oldNode = project.nodes.find((n) => n.id === id);
    if (!oldNode) return;

    // Check for duplicate file path (excluding the current node)
    if (updates.filePath && updates.filePath !== oldNode.filePath) {
      if (isPathDuplicate(project.nodes, updates.filePath, id)) {
        useToastStore.getState().addToast(`File path already exists: ${updates.filePath}`, 'error');
        return; // Reject the update
      }
    }

    const newNode = { ...oldNode, ...updates };

    set({
      project: {
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === id ? newNode : node
        ),
      },
    });

    // Handle file path changes (rename)
    if (updates.filePath && updates.filePath !== oldNode.filePath) {
      renameFile(project.projectPath, oldNode.filePath, updates.filePath).catch((err) => {
        console.error('Failed to rename file:', err);
        useToastStore.getState().addToast(`Failed to rename file`, 'error');
      });
    }

    // Write generated code to file when it's updated
    if (updates.generatedCode !== undefined && updates.generatedCode !== oldNode.generatedCode) {
      writeFile(project.projectPath, newNode.filePath, updates.generatedCode).catch((err) => {
        console.error('Failed to write file:', err);
        useToastStore.getState().addToast(`Failed to write generated code`, 'error');
      });
    }
  },

  deleteNode: (id) => {
    const { project, selectedNodeIds } = get();
    if (!project) return;

    const nodeToDelete = project.nodes.find((n) => n.id === id);
    if (!nodeToDelete) return;

    // Capture connected edges before deletion
    const connectedEdges = project.edges.filter(
      (edge) => edge.source === id || edge.target === id
    );

    set({
      project: {
        ...project,
        nodes: project.nodes.filter((node) => node.id !== id),
        edges: project.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
      },
      selectedNodeIds: selectedNodeIds.filter((nodeId) => nodeId !== id),
    });

    // Delete the file from disk and track for undo
    deleteFile(project.projectPath, nodeToDelete.filePath)
      .then((trashFilename) => {
        // Push to undo stack
        useUndoStore.getState().pushDeleteAction([
          {
            node: nodeToDelete,
            connectedEdges,
            trashFilename,
          },
        ]);
      })
      .catch((err) => {
        console.error('Failed to delete file:', err);
      });
  },

  deleteSelectedNodes: () => {
    const { project, selectedNodeIds } = get();
    if (!project || selectedNodeIds.length === 0) return;

    const idsToDelete = new Set(selectedNodeIds);
    const nodesToDelete = project.nodes.filter((node) => idsToDelete.has(node.id));

    // Capture connected edges for each node before deletion
    const nodeEdgesMap = new Map<string, CodeEdge[]>();
    for (const node of nodesToDelete) {
      nodeEdgesMap.set(
        node.id,
        project.edges.filter((e) => e.source === node.id || e.target === node.id)
      );
    }

    set({
      project: {
        ...project,
        nodes: project.nodes.filter((node) => !idsToDelete.has(node.id)),
        edges: project.edges.filter(
          (edge) => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target)
        ),
      },
      selectedNodeIds: [],
    });

    // Delete files from disk and track for undo
    const deletePromises = nodesToDelete.map((node) =>
      deleteFile(project.projectPath, node.filePath)
        .then((trashFilename): DeletedNodeInfo => ({
          node,
          connectedEdges: nodeEdgesMap.get(node.id) || [],
          trashFilename,
        }))
        .catch((err) => {
          console.error('Failed to delete file:', err);
          return null;
        })
    );

    Promise.all(deletePromises).then((results) => {
      const deletedNodes = results.filter((r): r is DeletedNodeInfo => r !== null);
      if (deletedNodes.length > 0) {
        useUndoStore.getState().pushDeleteAction(deletedNodes);
      }
    });
  },

  restoreDeletedNodes: async (deletedNodes) => {
    const { project } = get();
    if (!project) return;

    // Restore files from trash
    const restorePromises = deletedNodes.map((info) =>
      restoreFile(project.projectPath, info.trashFilename, info.node.filePath).catch((err) => {
        console.error('Failed to restore file:', err);
      })
    );

    await Promise.all(restorePromises);

    // Restore nodes and edges to project
    const restoredNodes = deletedNodes.map((info) => info.node);
    const allEdges = deletedNodes.flatMap((info) => info.connectedEdges);

    // Deduplicate edges (same edge might be in multiple nodes' connectedEdges)
    const uniqueEdges = Array.from(
      new Map(allEdges.map((e) => [e.id, e])).values()
    );

    // Filter out edges that connect to nodes not in the project
    const existingNodeIds = new Set([
      ...project.nodes.map((n) => n.id),
      ...restoredNodes.map((n) => n.id),
    ]);
    const validEdges = uniqueEdges.filter(
      (e) => existingNodeIds.has(e.source) && existingNodeIds.has(e.target)
    );

    set({
      project: {
        ...project,
        nodes: [...project.nodes, ...restoredNodes],
        edges: [...project.edges, ...validEdges],
      },
    });

    const nodeCount = restoredNodes.length;
    useToastStore.getState().addToast(
      `Restored ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`,
      'success'
    );
  },

  reDeleteNodes: async (deletedNodes) => {
    const { project } = get();
    if (!project) return;

    const nodeIds = new Set(deletedNodes.map((info) => info.node.id));

    // Remove nodes and their edges from project
    set({
      project: {
        ...project,
        nodes: project.nodes.filter((n) => !nodeIds.has(n.id)),
        edges: project.edges.filter(
          (e) => !nodeIds.has(e.source) && !nodeIds.has(e.target)
        ),
      },
    });

    // Delete files again (they were restored, now delete them)
    for (const info of deletedNodes) {
      try {
        const newTrashFilename = await deleteFile(project.projectPath, info.node.filePath);
        // Update the trash filename in the info for future undo/redo
        info.trashFilename = newTrashFilename;
      } catch (err) {
        console.error('Failed to re-delete file:', err);
      }
    }

    const nodeCount = deletedNodes.length;
    useToastStore.getState().addToast(
      `Deleted ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`,
      'info'
    );
  },

  addEdge: (edgeData) => {
    const { project } = get();
    if (!project) return { success: false, error: 'No project loaded' };

    // Check for self-loop
    if (edgeData.source === edgeData.target) {
      return { success: false, error: 'Cannot create an edge from a node to itself' };
    }

    // Check if edge already exists
    const edgeExists = project.edges.some(
      (e) => e.source === edgeData.source && e.target === edgeData.target
    );
    if (edgeExists) {
      return { success: false, error: 'Edge already exists' };
    }

    // Check for cycles
    if (wouldCreateCycle(project.nodes, project.edges, edgeData.source, edgeData.target)) {
      return { success: false, error: 'Adding this edge would create a circular dependency' };
    }

    const newEdge: CodeEdge = {
      ...edgeData,
      id: crypto.randomUUID(),
    };

    set({
      project: {
        ...project,
        edges: [...project.edges, newEdge],
      },
    });

    return { success: true };
  },

  updateEdge: (id, updates) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        edges: project.edges.map((edge) =>
          edge.id === id ? { ...edge, ...updates } : edge
        ),
      },
    });
  },

  deleteEdge: (id) => {
    const { project, selectedEdgeId } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        edges: project.edges.filter((edge) => edge.id !== id),
      },
      selectedEdgeId: selectedEdgeId === id ? null : selectedEdgeId,
    });
  },
}));
