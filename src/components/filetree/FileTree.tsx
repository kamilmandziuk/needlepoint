import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { buildFileTree, type FileTreeNode } from '../../lib/fileTree';
import type { NodeStatus } from '../../lib/types';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  onToggleFolder: (path: string) => void;
  onSelectFile: (nodeId: string) => void;
  selectedNodeIds: string[];
}

function getStatusColor(status?: NodeStatus): string {
  switch (status) {
    case 'complete':
      return 'text-green-400';
    case 'generating':
      return 'text-blue-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

function getFileIcon(status?: NodeStatus) {
  const colorClass = getStatusColor(status);
  return <File size={14} className={colorClass} />;
}

function FileTreeItem({ node, depth, onToggleFolder, onSelectFile, selectedNodeIds }: FileTreeItemProps) {
  const isSelected = node.nodeId ? selectedNodeIds.includes(node.nodeId) : false;
  const paddingLeft = depth * 12 + 8;

  if (node.type === 'folder') {
    const isExpanded = node.expanded ?? true;

    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="w-full flex items-center gap-1 py-1 px-2 hover:bg-gray-800 text-gray-300 text-sm transition-colors"
          style={{ paddingLeft }}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} className="text-yellow-500 flex-shrink-0" />
          ) : (
            <Folder size={14} className="text-yellow-500 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                selectedNodeIds={selectedNodeIds}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  return (
    <button
      onClick={() => node.nodeId && onSelectFile(node.nodeId)}
      className={`w-full flex items-center gap-1 py-1 px-2 text-sm transition-colors ${
        isSelected
          ? 'bg-blue-600/30 text-white'
          : 'hover:bg-gray-800 text-gray-300'
      }`}
      style={{ paddingLeft: paddingLeft + 18 }} // Extra indent since no chevron
    >
      {getFileIcon(node.status)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function FileTree() {
  const { project, selectedNodeIds, setSelectedNodes } = useProjectStore();
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});

  // Build initial tree from project nodes
  const initialTree = useMemo(() => {
    if (!project) return [];
    return buildFileTree(project.nodes);
  }, [project]);

  // Apply expanded state overrides
  const tree = useMemo(() => {
    const applyExpandedState = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.type === 'folder') {
          const expanded = expandedState[node.path] ?? node.expanded ?? true;
          return {
            ...node,
            expanded,
            children: node.children ? applyExpandedState(node.children) : undefined,
          };
        }
        return node;
      });
    };
    return applyExpandedState(initialTree);
  }, [initialTree, expandedState]);

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedState(prev => ({
      ...prev,
      [path]: !(prev[path] ?? true),
    }));
  }, []);

  const handleSelectFile = useCallback((nodeId: string) => {
    setSelectedNodes([nodeId]);
  }, [setSelectedNodes]);

  if (!project) {
    return (
      <div className="p-4 text-gray-500 text-sm text-center">
        No project loaded
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm text-center">
        No files yet.
        <br />
        Right-click on the canvas to add a node.
      </div>
    );
  }

  return (
    <div className="py-2">
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          onToggleFolder={handleToggleFolder}
          onSelectFile={handleSelectFile}
          selectedNodeIds={selectedNodeIds}
        />
      ))}
    </div>
  );
}
