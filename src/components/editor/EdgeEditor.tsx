import { useProjectStore } from '../../stores/projectStore';
import type { CodeEdge } from '../../lib/types';

interface EdgeEditorProps {
  edge: CodeEdge;
}

export default function EdgeEditor({ edge }: EdgeEditorProps) {
  const { project, updateEdge } = useProjectStore();

  // Find source and target node names for display
  const sourceNode = project?.nodes.find((n) => n.id === edge.source);
  const targetNode = project?.nodes.find((n) => n.id === edge.target);

  const handleLabelChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEdge(edge.id, { label: e.target.value });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Connection Info */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Connection
        </label>
        <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
          <div className="text-sm text-white">
            <span className="text-blue-400">{sourceNode?.name || 'Unknown'}</span>
            <span className="text-gray-500 mx-2">→</span>
            <span className="text-green-400">{targetNode?.name || 'Unknown'}</span>
          </div>
          <div className="text-sm text-gray-500 font-mono mt-1">
            {sourceNode?.filePath || '?'} → {targetNode?.filePath || '?'}
          </div>
        </div>
      </div>

      {/* Label/Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Relationship Description
        </label>
        <textarea
          value={edge.label}
          onChange={handleLabelChange}
          placeholder="e.g., imports types from, extends base class in"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />
        <p className="mt-1 text-xs text-gray-500">
          Included in the LLM prompt when generating the target file.
        </p>
      </div>

      {/* Quick Templates */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Quick Templates
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            'imports from',
            'extends',
            'implements',
            'uses',
            'depends on',
          ].map((template) => (
            <button
              key={template}
              onClick={() => updateEdge(edge.id, { label: template })}
              className="px-2 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
            >
              {template}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
