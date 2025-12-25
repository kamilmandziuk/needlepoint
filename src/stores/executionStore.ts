import { create } from 'zustand';
import type { ExecutionEvent, ExecutionPlan, NodeProgress, ApiKeysInput } from '../lib/types';
import { generateAll, getExecutionPlan, onExecutionProgress } from '../lib/tauri';
import { useProjectStore } from './projectStore';
import { useSettingsStore } from './settingsStore';

export type ExecutionStatus = 'idle' | 'planning' | 'running' | 'completed' | 'cancelled' | 'error';

interface ExecutionLog {
  timestamp: Date;
  nodeId?: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ExecutionState {
  status: ExecutionStatus;
  plan: ExecutionPlan | null;
  currentWave: number;
  totalWaves: number;
  completedNodes: number;
  totalNodes: number;
  failedNodes: string[];
  logs: ExecutionLog[];
  error: string | null;

  // Actions
  startExecution: () => Promise<void>;
  cancelExecution: () => void;
  clearLogs: () => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  plan: null,
  currentWave: 0,
  totalWaves: 0,
  completedNodes: 0,
  totalNodes: 0,
  failedNodes: [],
  logs: [],
  error: null,

  startExecution: async () => {
    const projectStore = useProjectStore.getState();
    const settingsStore = useSettingsStore.getState();

    if (!projectStore.project) {
      set({ error: 'No project loaded', status: 'error' });
      return;
    }

    // Reset state
    set({
      status: 'planning',
      plan: null,
      currentWave: 0,
      totalWaves: 0,
      completedNodes: 0,
      totalNodes: 0,
      failedNodes: [],
      logs: [],
      error: null,
    });

    // Add planning log
    set((state) => ({
      logs: [
        ...state.logs,
        {
          timestamp: new Date(),
          message: 'Building execution plan...',
          type: 'info',
        },
      ],
    }));

    try {
      // Get execution plan
      const plan = await getExecutionPlan(projectStore.project);
      set({ plan, totalNodes: plan.totalNodes, totalWaves: plan.waves.length });

      // Add plan log
      set((state) => ({
        logs: [
          ...state.logs,
          {
            timestamp: new Date(),
            message: `Execution plan: ${plan.totalNodes} nodes in ${plan.waves.length} waves`,
            type: 'info',
          },
        ],
      }));

      if (plan.skippedNodes.length > 0) {
        set((state) => ({
          logs: [
            ...state.logs,
            {
              timestamp: new Date(),
              message: `Warning: ${plan.skippedNodes.length} nodes skipped (cycle detected)`,
              type: 'warning',
            },
          ],
        }));
      }

      // Listen for progress events
      const unlisten = await onExecutionProgress((event: ExecutionEvent) => {
        handleExecutionEvent(event, set, get);
      });

      // Start execution
      set({ status: 'running' });

      // Prepare API keys
      const apiKeys: ApiKeysInput = {
        anthropic: settingsStore.settings.anthropicApiKey || undefined,
        openai: settingsStore.settings.openaiApiKey || undefined,
        ollamaBaseUrl: settingsStore.settings.ollamaBaseUrl || undefined,
      };

      // Execute
      const updatedProject = await generateAll(projectStore.project, apiKeys);

      // Update project in store
      projectStore.setProject(updatedProject);

      // Cleanup listener
      unlisten();
    } catch (error) {
      set({
        status: 'error',
        error: String(error),
      });
      set((state) => ({
        logs: [
          ...state.logs,
          {
            timestamp: new Date(),
            message: `Error: ${error}`,
            type: 'error',
          },
        ],
      }));
    }
  },

  cancelExecution: () => {
    // Note: Cancel functionality would require maintaining a reference to the executor
    // For now, we just update the UI state
    set({ status: 'cancelled' });
    set((state) => ({
      logs: [
        ...state.logs,
        {
          timestamp: new Date(),
          message: 'Execution cancelled',
          type: 'warning',
        },
      ],
    }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  reset: () => {
    set({
      status: 'idle',
      plan: null,
      currentWave: 0,
      totalWaves: 0,
      completedNodes: 0,
      totalNodes: 0,
      failedNodes: [],
      logs: [],
      error: null,
    });
  },
}));

function handleExecutionEvent(
  event: ExecutionEvent,
  set: (partial: Partial<ExecutionState> | ((state: ExecutionState) => Partial<ExecutionState>)) => void,
  get: () => ExecutionState
) {
  const addLog = (log: ExecutionLog) => {
    set((state) => ({
      logs: [...state.logs, log],
    }));
  };

  switch (event.type) {
    case 'started':
      set({
        status: 'running',
        totalNodes: event.totalNodes,
        totalWaves: event.totalWaves,
      });
      addLog({
        timestamp: new Date(),
        message: `Starting generation of ${event.totalNodes} nodes in ${event.totalWaves} waves`,
        type: 'info',
      });
      break;

    case 'waveStarted':
      set({ currentWave: event.waveNumber + 1 });
      addLog({
        timestamp: new Date(),
        message: `Wave ${event.waveNumber + 1}: Processing ${event.nodeIds.length} nodes`,
        type: 'info',
      });
      break;

    case 'nodeUpdate':
      handleNodeUpdate(event, set, get, addLog);
      break;

    case 'waveCompleted':
      addLog({
        timestamp: new Date(),
        message: `Wave ${event.waveNumber + 1} complete: ${event.successful} successful, ${event.failed} failed`,
        type: event.failed > 0 ? 'warning' : 'success',
      });
      break;

    case 'completed':
      set({
        status: 'completed',
        completedNodes: event.totalSuccessful,
      });
      addLog({
        timestamp: new Date(),
        message: `Execution complete: ${event.totalSuccessful} successful, ${event.totalFailed} failed, ${event.totalSkipped} skipped`,
        type: event.totalFailed > 0 ? 'warning' : 'success',
      });
      break;

    case 'cancelled':
      set({ status: 'cancelled' });
      addLog({
        timestamp: new Date(),
        message: 'Execution cancelled',
        type: 'warning',
      });
      break;

    case 'error':
      set({ status: 'error', error: event.message });
      addLog({
        timestamp: new Date(),
        message: `Error: ${event.message}`,
        type: 'error',
      });
      break;
  }
}

function handleNodeUpdate(
  event: NodeProgress & { type: 'nodeUpdate' },
  set: (partial: Partial<ExecutionState> | ((state: ExecutionState) => Partial<ExecutionState>)) => void,
  _get: () => ExecutionState,
  addLog: (log: ExecutionLog) => void
) {
  const projectStore = useProjectStore.getState();
  const node = projectStore.project?.nodes.find((n) => n.id === event.nodeId);
  const nodeName = node?.name || event.nodeId;

  switch (event.status) {
    case 'generating':
      addLog({
        timestamp: new Date(),
        nodeId: event.nodeId,
        message: `${nodeName}: Generating...`,
        type: 'info',
      });
      // Update node status in project store
      projectStore.updateNode(event.nodeId, { status: 'generating' });
      break;

    case 'complete':
      set((state) => ({
        completedNodes: state.completedNodes + 1,
      }));
      addLog({
        timestamp: new Date(),
        nodeId: event.nodeId,
        message: `${nodeName}: Complete`,
        type: 'success',
      });
      // Update node in project store
      projectStore.updateNode(event.nodeId, {
        status: 'complete',
        generatedCode: event.generatedCode,
        errorMessage: undefined,
      });
      break;

    case 'error':
      set((state) => ({
        failedNodes: [...state.failedNodes, event.nodeId],
      }));
      addLog({
        timestamp: new Date(),
        nodeId: event.nodeId,
        message: `${nodeName}: ${event.message || 'Failed'}`,
        type: 'error',
      });
      // Update node in project store
      projectStore.updateNode(event.nodeId, {
        status: 'error',
        errorMessage: event.message,
      });
      break;
  }
}
