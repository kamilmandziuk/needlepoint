import { useProjectStore } from '../../stores/projectStore';
import NodeEditor from '../editor/NodeEditor';

export default function PropertiesPanel() {
  const { selectedNodeId, project } = useProjectStore();

  const selectedNode = selectedNodeId
    ? project?.nodes.find((n) => n.id === selectedNodeId)
    : null;

  if (!selectedNode) {
    return (
      <aside className="w-80 bg-gray-900 border-l border-gray-800 p-4">
        <div className="text-gray-500 text-sm text-center mt-8">
          Select a node to view its properties
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
      <NodeEditor node={selectedNode} />
    </aside>
  );
}
