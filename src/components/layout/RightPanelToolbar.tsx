import { Play, Trash2, Loader2, StopCircle } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { generateNode } from '../../lib/tauri';

export default function RightPanelToolbar() {
  const {
    project,
    selectedNodeIds,
    selectedEdgeId,
    updateNode,
    deleteNode,
    deleteEdge,
    setSelectedEdge,
  } = useProjectStore();
  const { getApiKey } = useSettingsStore();
  const [isGenerating, setIsGenerating] = useState(false);

  // Get selected node (only for single selection)
  const selectedNode = selectedNodeIds.length === 1
    ? project?.nodes.find((n) => n.id === selectedNodeIds[0])
    : null;

  // Get selected edge
  const selectedEdge = selectedEdgeId
    ? project?.edges.find((e) => e.id === selectedEdgeId)
    : null;

  const handleGenerate = async () => {
    if (!project || !selectedNode) return;

    setIsGenerating(true);
    updateNode(selectedNode.id, { status: 'generating' });

    try {
      const apiKey = getApiKey(selectedNode.llmConfig.provider);
      const code = await generateNode(project, selectedNode.id, apiKey || undefined);
      updateNode(selectedNode.id, {
        generatedCode: code,
        status: 'complete',
        errorMessage: undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      updateNode(selectedNode.id, {
        status: 'error',
        errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge) {
      deleteEdge(selectedEdge.id);
      setSelectedEdge(null);
    }
  };

  // Show edge delete button when edge is selected
  if (selectedEdge) {
    return (
      <button
        onClick={handleDeleteEdge}
        className="p-1.5 rounded hover:bg-gray-800 text-red-500 hover:text-red-400"
        title="Delete Edge"
      >
        <Trash2 size={16} />
      </button>
    );
  }

  // Show node buttons when a single node is selected
  if (selectedNode) {
    return (
      <>
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
        {isGenerating && (
          <button
            onClick={() => setIsGenerating(false)}
            className="p-1.5 rounded hover:bg-gray-800 text-yellow-500 hover:text-yellow-400"
            title="Stop Generation"
          >
            <StopCircle size={16} />
          </button>
        )}
        <button
          onClick={handleDeleteNode}
          className="p-1.5 rounded hover:bg-gray-800 text-red-500 hover:text-red-400"
          title="Delete Node (moves to trash)"
        >
          <Trash2 size={16} />
        </button>
      </>
    );
  }

  return null;
}
