import { useProjectStore } from '../../stores/projectStore';
import type { CodeEdge } from '../../lib/types';

interface EdgeEditorProps {
  edge: CodeEdge;
}

export default function EdgeEditor({ edge }: EdgeEditorProps) {
  const { project, updateEdge, deleteEdge, setSelectedEdge } = useProjectStore();

  // Find source and target node names for display
  const sourceNode = project?.nodes.find((n) => n.id === edge.source);
  const targetNode = project?.nodes.find((n) => n.id === edge.target);

  const handleLabelChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEdge(edge.id, { label: e.target.value });
  };

  const handleDelete = () => {
    deleteEdge(edge.id);
    setSelectedEdge(null);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Edge Properties</h2>
        <button
          onClick={handleDelete}
          className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Connection Info */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="text-xs text-gray-400 mb-1">Connection</div>
        <div className="text-sm text-white">
          <span className="text-blue-400">{sourceNode?.name || 'Unknown'}</span>
          <span className="text-gray-500 mx-2">→</span>
          <span className="text-green-400">{targetNode?.name || 'Unknown'}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {sourceNode?.filePath || '?'} → {targetNode?.filePath || '?'}
        </div>
      </div>

      {/* Label/Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Relationship Description
        </label>
        <textarea
          value={edge.label}
          onChange={handleLabelChange}
          placeholder="Describe the relationship (e.g., 'imports types from', 'extends base class in', 'uses utility functions from')"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          This description will be included in the LLM prompt when generating the target file.
        </p>
      </div>

      {/* Quick Templates */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Quick Templates
        </label>
        <div className="flex flex-wrap gap-2">
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
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
            >
              {template}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
