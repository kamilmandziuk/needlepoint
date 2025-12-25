import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Eye, Loader2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { generateNode, previewPrompt } from '../../lib/tauri';
import type { CodeNode, Language } from '../../lib/types';

interface CodePreviewProps {
  node: CodeNode;
}

// Map our language types to Monaco language IDs
const languageToMonaco: Record<Language, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  rust: 'rust',
  go: 'go',
};

type ViewMode = 'code' | 'prompt';

export default function CodePreview({ node }: CodePreviewProps) {
  const { project, updateNode } = useProjectStore();
  const { getApiKey } = useSettingsStore();
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prompt preview
  useEffect(() => {
    if (project && viewMode === 'prompt') {
      previewPrompt(project, node.id)
        .then(setPrompt)
        .catch((err) => setPrompt(`Error loading prompt: ${err}`));
    }
  }, [project, node.id, viewMode]);

  const handleGenerate = async () => {
    if (!project) return;

    setIsGenerating(true);
    setError(null);
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
      setViewMode('code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      updateNode(node.id, {
        status: 'error',
        errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      updateNode(node.id, { generatedCode: value });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('code')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'code'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Code
          </button>
          <button
            onClick={() => setViewMode('prompt')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              viewMode === 'prompt'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Eye size={12} />
            Prompt
          </button>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
            isGenerating
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play size={12} />
              Generate
            </>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-900/50 border-b border-red-800 text-red-200 text-xs">
          <AlertCircle size={14} />
          <span className="flex-1 truncate">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {viewMode === 'code' ? (
          <Editor
            height="100%"
            language={languageToMonaco[node.language]}
            value={node.generatedCode || '// No code generated yet\n// Click "Generate" to create code for this node'}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              readOnly: false,
              tabSize: 2,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language="markdown"
            value={prompt || 'Loading prompt preview...'}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              readOnly: true,
              tabSize: 2,
            }}
          />
        )}
      </div>
    </div>
  );
}
