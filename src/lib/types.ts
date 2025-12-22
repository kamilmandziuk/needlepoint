// Core data types matching Rust backend structs

export type NodeStatus = 'pending' | 'generating' | 'complete' | 'error' | 'warning';

export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export type EdgeType = 'imports' | 'implements' | 'extends' | 'calls' | 'uses';

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
  type: EdgeType;
  metadata: {
    description: string;
    importedSymbols?: string[];
  };
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
