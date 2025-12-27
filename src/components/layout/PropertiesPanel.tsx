import { useProjectStore } from '../../stores/projectStore';
import NodeEditor from '../editor/NodeEditor';
import EdgeEditor from '../editor/EdgeEditor';

export default function PropertiesPanel() {
  const { selectedNodeId, selectedEdgeId, project } = useProjectStore();

  const selectedNode = selectedNodeId
    ? project?.nodes.find((n) => n.id === selectedNodeId)
    : null;

  const selectedEdge = selectedEdgeId
    ? project?.edges.find((e) => e.id === selectedEdgeId)
    : null;

  // Show edge editor if edge is selected
  if (selectedEdge) {
    return (
      <aside className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <EdgeEditor edge={selectedEdge} />
      </aside>
    );
  }

  // Show node editor if node is selected
  if (selectedNode) {
    return (
      <aside className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <NodeEditor key={selectedNode.id} node={selectedNode} />
      </aside>
    );
  }

  // Show placeholder
  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-800 p-4">
      <div className="text-gray-500 text-sm text-center mt-8">
        Select a node or edge to view its properties
      </div>
    </aside>
  );
}
