import { useProjectStore } from '../../stores/projectStore';
import NodeEditor from '../editor/NodeEditor';
import EdgeEditor from '../editor/EdgeEditor';

export default function PropertiesPanel() {
  const { selectedNodeIds, selectedEdgeId, project } = useProjectStore();

  // Get the single selected node (only show editor for single selection)
  const selectedNode = selectedNodeIds.length === 1
    ? project?.nodes.find((n) => n.id === selectedNodeIds[0])
    : null;

  const selectedEdge = selectedEdgeId
    ? project?.edges.find((e) => e.id === selectedEdgeId)
    : null;

  // Show edge editor if edge is selected
  if (selectedEdge) {
    return (
      <div className="h-full bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <EdgeEditor edge={selectedEdge} />
      </div>
    );
  }

  // Show node editor if exactly one node is selected
  if (selectedNode) {
    return (
      <div className="h-full bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <NodeEditor key={selectedNode.id} node={selectedNode} />
      </div>
    );
  }

  // Show multi-selection info
  if (selectedNodeIds.length > 1) {
    return (
      <div className="h-full bg-gray-900 border-l border-gray-800 p-4">
        <div className="text-gray-400 text-sm text-center mt-8">
          <div className="text-white font-medium mb-2">{selectedNodeIds.length} nodes selected</div>
          <div className="text-gray-500">Press Delete to remove all selected nodes</div>
        </div>
      </div>
    );
  }

  // Show placeholder
  return (
    <div className="h-full bg-gray-900 border-l border-gray-800 p-4">
      <div className="text-gray-500 text-sm text-center mt-8">
        Select a node or edge to view its properties
      </div>
    </div>
  );
}
