import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useProjectStore } from '../../stores/projectStore';
import CodeNode from './CodeNode';
import DependencyEdge from './DependencyEdge';
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
function toFlowNode(node: CodeNodeType): Node {
  return {
    id: node.id,
    type: 'codeNode',
    position: node.position,
    data: node as unknown as Record<string, unknown>,
  };
}

// Convert our CodeEdge to ReactFlow Edge
function toFlowEdge(edge: CodeEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'dependency',
    data: edge as unknown as Record<string, unknown>,
    animated: false,
  };
}

export default function GraphCanvas() {
  const {
    project,
    setSelectedNode,
    updateNode,
    addEdge: addProjectEdge,
    addNode,
  } = useProjectStore();

  // Convert project nodes/edges to ReactFlow format
  const flowNodes = useMemo(
    () => (project?.nodes || []).map(toFlowNode),
    [project?.nodes]
  );

  const flowEdges = useMemo(
    () => (project?.edges || []).map(toFlowEdge),
    [project?.edges]
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
        addProjectEdge({
          source: connection.source,
          target: connection.target,
          type: 'imports',
          metadata: {
            description: '',
          },
        });
      }
    },
    [addProjectEdge]
  );

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, node: any) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (!project) return;

      // Get position relative to canvas
      const bounds = (event.target as HTMLElement).getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      // Add a new node at click position
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
    [project, addNode]
  );

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
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onContextMenu={handleContextMenu}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      className="bg-canvas-bg"
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
  );
}
