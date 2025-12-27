import { create } from 'zustand';
import type { CodeNode, CodeEdge } from '../lib/types';

/**
 * Represents a deleted node that can be restored
 */
interface DeletedNodeInfo {
  node: CodeNode;
  connectedEdges: CodeEdge[];
  trashFilename: string;
}

/**
 * An undoable action
 */
interface UndoAction {
  type: 'delete_nodes';
  deletedNodes: DeletedNodeInfo[];
  timestamp: number;
}

interface UndoState {
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  maxStackSize: number;

  // Actions
  pushDeleteAction: (deletedNodes: DeletedNodeInfo[]) => void;
  undo: () => UndoAction | null;
  redo: () => UndoAction | null;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxStackSize: 50,

  pushDeleteAction: (deletedNodes) => {
    const action: UndoAction = {
      type: 'delete_nodes',
      deletedNodes,
      timestamp: Date.now(),
    };

    set((state) => {
      const newStack = [...state.undoStack, action];
      // Limit stack size
      if (newStack.length > state.maxStackSize) {
        newStack.shift();
      }
      return {
        undoStack: newStack,
        redoStack: [], // Clear redo stack on new action
      };
    });
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;

    const action = undoStack[undoStack.length - 1];

    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
    }));

    return action;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;

    const action = redoStack[redoStack.length - 1];

    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
    }));

    return action;
  },

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,
}));

// Export types for use in other stores
export type { DeletedNodeInfo, UndoAction };
