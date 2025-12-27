import type { CodeNode, NodeStatus } from './types';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  // For files: the associated CodeNode id
  nodeId?: string;
  // For files: the node status
  status?: NodeStatus;
  // For folders: child nodes
  children?: FileTreeNode[];
  // Is folder expanded?
  expanded?: boolean;
}

/**
 * Build a file tree from a list of CodeNodes based on their file paths
 */
export function buildFileTree(nodes: CodeNode[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // Sort nodes by path for consistent ordering
  const sortedNodes = [...nodes].sort((a, b) => a.filePath.localeCompare(b.filePath));

  for (const node of sortedNodes) {
    const parts = node.filePath.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      // Find existing node at this level
      let existing = currentLevel.find(n => n.name === part);

      if (!existing) {
        if (isFile) {
          // Create file node
          existing = {
            name: part,
            path: currentPath,
            type: 'file',
            nodeId: node.id,
            status: node.status,
          };
        } else {
          // Create folder node
          existing = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
            expanded: true, // Default to expanded
          };
        }
        currentLevel.push(existing);
      } else if (isFile) {
        // Update existing file node (shouldn't happen normally)
        existing.nodeId = node.id;
        existing.status = node.status;
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort each level: folders first, then files, alphabetically within each group
  const sortLevel = (level: FileTreeNode[]) => {
    level.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of level) {
      if (node.children) {
        sortLevel(node.children);
      }
    }
  };

  sortLevel(root);

  return root;
}

/**
 * Get the file extension from a file name
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Get all folder paths from a file path
 */
export function getFolderPaths(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean);
  const folders: string[] = [];
  let currentPath = '';

  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    folders.push(currentPath);
  }

  return folders;
}

/**
 * Toggle folder expanded state in the tree
 */
export function toggleFolder(tree: FileTreeNode[], folderPath: string): FileTreeNode[] {
  return tree.map(node => {
    if (node.path === folderPath && node.type === 'folder') {
      return { ...node, expanded: !node.expanded };
    }
    if (node.children) {
      return { ...node, children: toggleFolder(node.children, folderPath) };
    }
    return node;
  });
}

/**
 * Find a node in the tree by path
 */
export function findNodeByPath(tree: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of tree) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Count files in a folder (recursively)
 */
export function countFilesInFolder(node: FileTreeNode): number {
  if (node.type === 'file') return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countFilesInFolder(child), 0);
}
