import { FolderOpen, Save, Plus, Play, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import FileTree from '../filetree/FileTree';

interface LeftPanelProps {
  onOpenSettings: () => void;
  onOpenExecutionMonitor: () => void;
}

export default function LeftPanel({ onOpenSettings, onOpenExecutionMonitor }: LeftPanelProps) {
  const { project, loadProject, saveProject, createProject } = useProjectStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <aside className="w-10 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2 relative z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Expand Panel"
        >
          <ChevronRight size={16} />
        </button>

        <div className="flex-1" />

        <button
          onClick={onOpenExecutionMonitor}
          disabled={!project || project.nodes.length === 0}
          className="p-2 rounded hover:bg-gray-800 text-green-500 hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate All"
        >
          <Play size={16} />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-300 truncate">
          {project?.manifest.name || 'Needlepoint'}
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-800">
        <button
          onClick={createProject}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="New Project"
        >
          <Plus size={16} />
        </button>

        <button
          onClick={loadProject}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Open Project"
        >
          <FolderOpen size={16} />
        </button>

        <button
          onClick={saveProject}
          disabled={!project}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save Project"
        >
          <Save size={16} />
        </button>

        <div className="flex-1" />

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Files
          </span>
        </div>
        <FileTree />
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-gray-800 p-2">
        <button
          onClick={onOpenExecutionMonitor}
          disabled={!project || project.nodes.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          <Play size={16} />
          Generate All
        </button>
      </div>
    </aside>
  );
}
