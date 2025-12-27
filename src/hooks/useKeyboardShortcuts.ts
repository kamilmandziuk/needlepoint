import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUndoStore } from '../stores/undoStore';

/**
 * Global keyboard shortcuts hook
 * Handles: Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo), Ctrl+S (save), Ctrl+A (select all)
 * Note: Delete is handled locally in GraphCanvas to support confirmation dialog
 */
export function useKeyboardShortcuts() {
  const {
    project,
    setSelectedNodes,
    saveProject,
    restoreDeletedNodes,
    reDeleteNodes,
  } = useProjectStore();

  const { undo, redo, canUndo, canRedo } = useUndoStore();

  const handleUndo = useCallback(async () => {
    if (!canUndo()) return;

    const action = undo();
    if (!action) return;

    if (action.type === 'delete_nodes') {
      await restoreDeletedNodes(action.deletedNodes);
    }
  }, [canUndo, undo, restoreDeletedNodes]);

  const handleRedo = useCallback(async () => {
    if (!canRedo()) return;

    const action = redo();
    if (!action) return;

    if (action.type === 'delete_nodes') {
      await reDeleteNodes(action.deletedNodes);
    }
  }, [canRedo, redo, reDeleteNodes]);

  const handleSelectAll = useCallback(() => {
    if (!project) return;
    const allNodeIds = project.nodes.map((n) => n.id);
    setSelectedNodes(allNodeIds);
  }, [project, setSelectedNodes]);

  const handleSave = useCallback(() => {
    if (!project) return;
    saveProject();
  }, [project, saveProject]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field - don't intercept shortcuts there
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Ctrl/Cmd + Z - Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z - Redo
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === 'y' || (event.key === 'Z' && event.shiftKey))
      ) {
        event.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + S - Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      // Ctrl/Cmd + A - Select All (only when not in input field)
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !isInputField) {
        event.preventDefault();
        handleSelectAll();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleSelectAll]);

  // Return functions for use in UI (e.g., menu items)
  return {
    handleUndo,
    handleRedo,
    handleSave,
    handleSelectAll,
    canUndo,
    canRedo,
  };
}
