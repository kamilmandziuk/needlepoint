import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Eye } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { previewPrompt } from '../../lib/tauri';
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
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [prompt, setPrompt] = useState<string>('');

  // Load prompt preview
  useEffect(() => {
    if (project && viewMode === 'prompt') {
      previewPrompt(project, node.id)
        .then(setPrompt)
        .catch((err) => setPrompt(`Error loading prompt: ${err}`));
    }
  }, [project, node.id, viewMode]);

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      updateNode(node.id, { generatedCode: value });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-gray-700 bg-gray-800">
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
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {viewMode === 'code' ? (
          <Editor
            key="code-editor"
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
            key="prompt-editor"
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
