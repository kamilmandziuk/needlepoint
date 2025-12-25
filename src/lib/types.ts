// Core data types matching Rust backend structs

export type NodeStatus = 'pending' | 'generating' | 'complete' | 'error' | 'warning';

export type LLMProvider = 'anthropic' | 'openai' | 'ollama';


export type Language = 'typescript' | 'javascript' | 'python' | 'rust' | 'go';

export interface ExportSignature {
  name: string;
  type: string;
  description: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  constraints: string[];
}

export interface CodeNode {
  id: string;
  name: string;
  filePath: string;
  language: Language;
  status: NodeStatus;
  description: string;
  purpose: string;
  exports: ExportSignature[];
  llmConfig: LLMConfig;
  generatedCode?: string;
  errorMessage?: string;
  // Position for ReactFlow
  position: { x: number; y: number };
}

export interface CodeEdge {
  id: string;
  source: string;
  target: string;
  /** Human-readable label describing the relationship */
  label: string;
}

export interface ProjectManifest {
  name: string;
  version: string;
  entryPoint?: string;
  defaultLLM: {
    provider: LLMProvider;
    model: string;
    apiKeyEnv: string;
  };
}

export interface Project {
  manifest: ProjectManifest;
  nodes: CodeNode[];
  edges: CodeEdge[];
  projectPath: string;
}

// Default values
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  constraints: [],
};

export const DEFAULT_PROJECT_MANIFEST: ProjectManifest = {
  name: 'New Project',
  version: '0.1.0',
  defaultLLM: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

// Orchestration types

export interface ExecutionWave {
  waveNumber: number;
  nodeIds: string[];
}

export interface ExecutionPlan {
  waves: ExecutionWave[];
  totalNodes: number;
  skippedNodes: string[];
}

export interface NodeProgress {
  nodeId: string;
  status: NodeStatus;
  message?: string;
  generatedCode?: string;
}

export type ExecutionEvent =
  | { type: 'started'; totalNodes: number; totalWaves: number }
  | { type: 'waveStarted'; waveNumber: number; nodeIds: string[] }
  | { type: 'nodeUpdate' } & NodeProgress
  | { type: 'waveCompleted'; waveNumber: number; successful: number; failed: number }
  | { type: 'completed'; totalSuccessful: number; totalFailed: number; totalSkipped: number }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

export interface ApiKeysInput {
  anthropic?: string;
  openai?: string;
  ollamaBaseUrl?: string;
}
