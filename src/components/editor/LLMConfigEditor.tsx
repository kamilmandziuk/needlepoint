import { Plus, Trash2 } from 'lucide-react';
import type { LLMConfig, LLMProvider } from '../../lib/types';

interface LLMConfigEditorProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

const providerModels: Record<LLMProvider, string[]> = {
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  ollama: [
    'llama3.2',
    'codellama',
    'mistral',
    'deepseek-coder',
    'qwen2.5-coder',
  ],
};

export default function LLMConfigEditor({ config, onChange }: LLMConfigEditorProps) {
  const updateConfig = <K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const addConstraint = () => {
    updateConfig('constraints', [...config.constraints, '']);
  };

  const updateConstraint = (index: number, value: string) => {
    const updated = [...config.constraints];
    updated[index] = value;
    updateConfig('constraints', updated);
  };

  const removeConstraint = (index: number) => {
    updateConfig(
      'constraints',
      config.constraints.filter((_, i) => i !== index)
    );
  };

  const models = providerModels[config.provider] || [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Provider
        </label>
        <select
          value={config.provider}
          onChange={(e) => {
            const provider = e.target.value as LLMProvider;
            const defaultModel = providerModels[provider]?.[0] || '';
            onChange({ ...config, provider, model: defaultModel });
          }}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Model
        </label>
        <select
          value={config.model}
          onChange={(e) => updateConfig('model', e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          System Prompt (Optional)
        </label>
        <textarea
          value={config.systemPrompt || ''}
          onChange={(e) => updateConfig('systemPrompt', e.target.value)}
          rows={4}
          placeholder="Additional instructions for the LLM when generating this file..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">
            Constraints
          </label>
          <button
            type="button"
            onClick={addConstraint}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {config.constraints.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm border border-dashed border-gray-700 rounded-md">
            No constraints defined.
          </div>
        ) : (
          <div className="space-y-2">
            {config.constraints.map((constraint, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={constraint}
                  onChange={(e) => updateConstraint(index, e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeConstraint(index)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Specific requirements the LLM must follow. Examples: "Use async/await instead of callbacks", "Include JSDoc comments", "Follow REST naming conventions".
        </p>
      </div>
    </div>
  );
}
