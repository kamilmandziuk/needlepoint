import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Play, Trash2, Save } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { CodeNode } from '../../lib/types';
import ExportsEditor from './ExportsEditor';
import LLMConfigEditor from './LLMConfigEditor';

interface NodeEditorProps {
  node: CodeNode;
}

type Tab = 'general' | 'exports' | 'llm';

export default function NodeEditor({ node }: NodeEditorProps) {
  const { updateNode, deleteNode } = useProjectStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const { register, handleSubmit } = useForm<CodeNode>({
    defaultValues: node,
  });

  const onSubmit = (data: CodeNode) => {
    updateNode(node.id, data);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'exports', label: 'Exports' },
    { id: 'llm', label: 'LLM Config' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-white truncate">{node.name}</h2>
          <div className="flex gap-1">
            <button
              className="p-1.5 rounded hover:bg-gray-800 text-green-500 hover:text-green-400"
              title="Generate"
            >
              <Play size={16} />
            </button>
            <button
              onClick={() => deleteNode(node.id)}
              className="p-1.5 rounded hover:bg-gray-800 text-red-500 hover:text-red-400"
              title="Delete Node"
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
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 overflow-y-auto p-4"
      >
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Name
              </label>
              <input
                {...register('name')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                File Path
              </label>
              <input
                {...register('filePath')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Language
              </label>
              <select
                {...register('language')}
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
                {...register('description')}
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
                {...register('purpose')}
                rows={2}
                placeholder="What is the main purpose of this file?"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'exports' && (
          <ExportsEditor
            exports={node.exports}
            onChange={(exports) => updateNode(node.id, { exports })}
          />
        )}

        {activeTab === 'llm' && (
          <LLMConfigEditor
            config={node.llmConfig}
            onChange={(llmConfig) => updateNode(node.id, { llmConfig })}
          />
        )}

        {/* Save button */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
