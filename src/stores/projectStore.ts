import { create } from 'zustand';
import type {
  Project,
  CodeNode,
  CodeEdge,
} from '../lib/types';
import { loadProjectFromPath, saveProjectToPath, selectProjectFolder } from '../lib/tauri';

interface ProjectState {
  project: Project | null;
  selectedNodeId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProject: (project: Project | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  createProject: () => Promise<void>;
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  addNode: (node: Omit<CodeNode, 'id'>) => void;
  updateNode: (id: string, updates: Partial<CodeNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Omit<CodeEdge, 'id'>) => void;
  updateEdge: (id: string, updates: Partial<CodeEdge>) => void;
  deleteEdge: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  selectedNodeId: null,
  isLoading: false,
  error: null,

  setProject: (project) => set({ project }),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

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
    if (!project) return;

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
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        edges: project.edges.filter((edge) => edge.id !== id),
      },
    });
  },
}));
