import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, Copy, Play, Settings } from 'lucide-react';

import { useProjectStore } from '../../stores/projectStore';
import CodeNode from './CodeNode';
import DependencyEdge from './DependencyEdge';
import ContextMenu from './ContextMenu';
import type { ContextMenuOption } from './ContextMenu';
import type { CodeNode as CodeNodeType, CodeEdge, NodeStatus } from '../../lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  codeNode: CodeNode,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = {
  dependency: DependencyEdge,
};

// Convert our CodeNode to ReactFlow Node
function toFlowNode(node: CodeNodeType, edges: CodeEdge[], totalNodes: number): Node {
  // Check if node is orphan (not connected to any edge)
  const isOrphan = totalNodes > 1 && !edges.some(
    (e) => e.source === node.id || e.target === node.id
  );

  return {
    id: node.id,
    type: 'codeNode',
    position: node.position,
    data: { ...node, isOrphan } as unknown as Record<string, unknown>,
  };
}

// Convert our CodeEdge to ReactFlow Edge
function toFlowEdge(edge: CodeEdge, isSelected: boolean): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'dependency',
    data: edge as unknown as Record<string, unknown>,
    animated: false,
    selected: isSelected,
  };
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'pane' | 'node' | 'edge';
  targetId?: string;
}

function GraphCanvasInner() {
  const {
    project,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNode,
    setSelectedEdge,
    updateNode,
    deleteNode,
    addEdge: addProjectEdge,
    deleteEdge,
    addNode,
  } = useProjectStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const reactFlowInstance = useReactFlow();

  // Convert project nodes/edges to ReactFlow format
  const flowNodes = useMemo(() => {
    const projectNodes = project?.nodes || [];
    const projectEdges = project?.edges || [];
    return projectNodes.map((node) => toFlowNode(node, projectEdges, projectNodes.length));
  }, [project?.nodes, project?.edges]);

  const flowEdges = useMemo(
    () => (project?.edges || []).map((edge) => toFlowEdge(edge, edge.id === selectedEdgeId)),
    [project?.edges, selectedEdgeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync nodes when project changes
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle keyboard events for delete
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected node
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
          setSelectedNode(null);
        }
        // Delete selected edge
        if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
          setSelectedEdge(null);
        }
      }
      // Escape to deselect and close context menu
      if (event.key === 'Escape') {
        setSelectedNode(null);
        setSelectedEdge(null);
        closeContextMenu();
      }
    },
    [selectedNodeId, selectedEdgeId, deleteNode, deleteEdge, setSelectedNode, setSelectedEdge, closeContextMenu]
  );

  // Sync ReactFlow state back to project store
  const handleNodesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: any) => {
      onNodesChange(changes);

      // Update positions in store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, updateNode]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const result = addProjectEdge({
          source: connection.source,
          target: connection.target,
          label: '',
        });
        if (!result.success && result.error) {
          // Show error notification
          alert(result.error);
        }
      }
    },
    [addProjectEdge]
  );

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, node: any) => {
      setSelectedNode(node.id);
      closeContextMenu();
    },
    [setSelectedNode, closeContextMenu]
  );

  const handleEdgeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, edge: any) => {
      setSelectedEdge(edge.id);
      closeContextMenu();
    },
    [setSelectedEdge, closeContextMenu]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    closeContextMenu();
  }, [setSelectedNode, setSelectedEdge, closeContextMenu]);

  // Add node at position
  const addNodeAtPosition = useCallback(
    (screenX: number, screenY: number) => {
      if (!project) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: screenX,
        y: screenY,
      });

      addNode({
        name: 'NewFile',
        filePath: 'src/new-file.ts',
        language: 'typescript',
        status: 'pending',
        description: '',
        purpose: '',
        exports: [],
        llmConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          constraints: [],
        },
        position,
      });
    },
    [project, addNode, reactFlowInstance]
  );

  // Duplicate node
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = project?.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      addNode({
        ...node,
        name: `${node.name}_copy`,
        filePath: node.filePath.replace(/(\.[^.]+)$/, '_copy$1'),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
      });
    },
    [project?.nodes, addNode]
  );

  // Context menu for pane (empty canvas area)
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'pane',
      });
    },
    []
  );

  // Context menu for nodes
  const handleNodeContextMenu = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      setSelectedNode(node.id);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        targetId: node.id,
      });
    },
    [setSelectedNode]
  );

  // Context menu for edges
  const handleEdgeContextMenu = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      setSelectedEdge(edge.id);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        targetId: edge.id,
      });
    },
    [setSelectedEdge]
  );

  // Build context menu options based on type
  const contextMenuOptions = useMemo((): ContextMenuOption[] => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'pane') {
      return [
        {
          label: 'Add Node',
          icon: <Plus size={14} />,
          onClick: () => addNodeAtPosition(contextMenu.x, contextMenu.y),
        },
      ];
    }

    if (contextMenu.type === 'node' && contextMenu.targetId) {
      const nodeId = contextMenu.targetId;
      return [
        {
          label: 'Generate Code',
          icon: <Play size={14} />,
          onClick: () => {
            // TODO: Implement code generation
            console.log('Generate code for node:', nodeId);
          },
        },
        {
          label: 'Duplicate',
          icon: <Copy size={14} />,
          onClick: () => duplicateNode(nodeId),
        },
        {
          label: 'Edit Settings',
          icon: <Settings size={14} />,
          onClick: () => setSelectedNode(nodeId),
        },
        {
          label: 'Delete',
          icon: <Trash2 size={14} />,
          onClick: () => {
            deleteNode(nodeId);
            setSelectedNode(null);
          },
          danger: true,
        },
      ];
    }

    if (contextMenu.type === 'edge' && contextMenu.targetId) {
      const edgeId = contextMenu.targetId;

      return [
        {
          label: 'Delete',
          icon: <Trash2 size={14} />,
          onClick: () => {
            deleteEdge(edgeId);
          },
          danger: true,
        },
      ];
    }

    return [];
  }, [contextMenu, addNodeAtPosition, duplicateNode, deleteNode, deleteEdge, setSelectedNode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getNodeColor = (node: any) => {
    const status = (node.data as CodeNodeType)?.status as NodeStatus | undefined;
    switch (status) {
      case 'complete':
        return '#15803d';
      case 'generating':
        return '#1d4ed8';
      case 'error':
        return '#dc2626';
      case 'warning':
        return '#d97706';
      default:
        return '#374151';
    }
  };

  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No project loaded</p>
          <p className="text-sm">
            Create a new project or open an existing one to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-canvas-bg"
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />
        <Controls className="bg-gray-800 border-gray-700" />
        <MiniMap
          className="bg-gray-800 border-gray-700"
          nodeColor={getNodeColor}
        />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={contextMenuOptions}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

// Wrapper to provide ReactFlow context
export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}
