import { useState, useMemo, useEffect } from 'react';
import { Play, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { generateNode, validateFilePath } from '../../lib/tauri';
import type { CodeNode } from '../../lib/types';
import LLMConfigEditor from './LLMConfigEditor';
import CodePreview from './CodePreview';

/**
 * Check if a file path is a duplicate (exists in another node)
 */
function isPathDuplicate(nodes: CodeNode[], filePath: string, excludeNodeId: string): boolean {
  return nodes.some(
    (node) => node.filePath === filePath && node.id !== excludeNodeId
  );
}

interface NodeEditorProps {
  node: CodeNode;
}

type Tab = 'general' | 'llm' | 'code';

export default function NodeEditor({ node }: NodeEditorProps) {
  const { project, updateNode, deleteNode } = useProjectStore();
  const { getApiKey } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [filePathInput, setFilePathInput] = useState(node.filePath);

  // Get all nodes for duplicate checking
  const allNodes = useMemo(() => project?.nodes || [], [project?.nodes]);

  // Sync input with node when node changes (e.g., external updates)
  useEffect(() => {
    setFilePathInput(node.filePath);
    setPathError(null);
  }, [node.filePath]);

  const handleGenerate = async () => {
    if (!project) return;

    setIsGenerating(true);
    updateNode(node.id, { status: 'generating' });

    try {
      // Get API key from settings based on the node's LLM provider
      const apiKey = getApiKey(node.llmConfig.provider);
      const code = await generateNode(project, node.id, apiKey || undefined);
      updateNode(node.id, {
        generatedCode: code,
        status: 'complete',
        errorMessage: undefined,
      });
      setActiveTab('code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateNode(node.id, {
        status: 'error',
        errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChange = (field: keyof CodeNode, value: string) => {
    // Validate file path before updating
    if (field === 'filePath') {
      const error = validateFilePath(value);
      setPathError(error);
      if (error) {
        return; // Don't update if path is invalid
      }
    }
    updateNode(node.id, { [field]: value });
  };

  const handleFilePathChange = (value: string) => {
    // Always update the input display
    setFilePathInput(value);

    // Validate format first
    const formatError = validateFilePath(value);
    if (formatError) {
      setPathError(formatError);
      return;
    }

    // Check for duplicate paths (excluding current node)
    if (isPathDuplicate(allNodes, value, node.id)) {
      setPathError('This file path is already used by another node');
      return;
    }

    // Clear error and update node
    setPathError(null);
    updateNode(node.id, { filePath: value });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'llm', label: 'LLM Config' },
    { id: 'code', label: 'Code' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-white truncate">{node.name}</h2>
          <div className="flex gap-1">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`p-1.5 rounded ${
                isGenerating
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'hover:bg-gray-800 text-green-500 hover:text-green-400'
              }`}
              title={isGenerating ? 'Generating...' : 'Generate'}
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
            </button>
            <button
              onClick={() => deleteNode(node.id)}
              className="p-1.5 rounded hover:bg-gray-800 text-red-500 hover:text-red-400"
              title="Delete Node (moves to trash)"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-400 font-mono truncate">
          {node.filePath}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 py-2 text-sm font-medium transition-colors
              ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              value={node.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              File Path
            </label>
            <input
              value={filePathInput}
              onChange={(e) => handleFilePathChange(e.target.value)}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-md text-white text-sm font-mono focus:outline-none focus:ring-2 ${
                pathError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:ring-blue-500'
              }`}
            />
            {pathError && (
              <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle size={12} />
                {pathError}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Language
            </label>
            <select
              value={node.language}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={node.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              placeholder="What does this file do?"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Purpose
            </label>
            <textarea
              value={node.purpose}
              onChange={(e) => handleChange('purpose', e.target.value)}
              rows={2}
              placeholder="What is the main purpose of this file?"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {activeTab === 'llm' && (
        <div className="flex-1 overflow-y-auto p-4">
          <LLMConfigEditor
            config={node.llmConfig}
            onChange={(llmConfig) => updateNode(node.id, { llmConfig })}
          />
        </div>
      )}

      {/* Code tab */}
      {activeTab === 'code' && (
        <div className="flex-1 min-h-0">
          <CodePreview node={node} />
        </div>
      )}
    </div>
  );
}
