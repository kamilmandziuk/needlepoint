import { create } from 'zustand';
import type {
  Project,
  CodeNode,
  CodeEdge,
} from '../lib/types';
import { loadProjectFromPath, saveProjectToPath, selectProjectFolder } from '../lib/tauri';

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
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProject: (project: Project | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  createProject: () => Promise<void>;
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  addNode: (node: Omit<CodeNode, 'id'>) => void;
  updateNode: (id: string, updates: Partial<CodeNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Omit<CodeEdge, 'id'>) => { success: boolean; error?: string };
  updateEdge: (id: string, updates: Partial<CodeEdge>) => void;
  deleteEdge: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  isLoading: false,
  error: null,

  setProject: (project) => set({ project }),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  setSelectedEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

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

      set({ project: newProject, selectedNodeId: null, error: null });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadProject: async () => {
    set({ isLoading: true, error: null });
    try {
      const project = await loadProjectFromPath();
      if (project) {
        set({ project, selectedNodeId: null });
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
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  addNode: (nodeData) => {
    const { project } = get();
    if (!project) return;

    const newNode: CodeNode = {
      ...nodeData,
      id: crypto.randomUUID(),
    };

    set({
      project: {
        ...project,
        nodes: [...project.nodes, newNode],
      },
    });
  },

  updateNode: (id, updates) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === id ? { ...node, ...updates } : node
        ),
      },
    });
  },

  deleteNode: (id) => {
    const { project, selectedNodeId } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        nodes: project.nodes.filter((node) => node.id !== id),
        edges: project.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
      },
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
    });
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
