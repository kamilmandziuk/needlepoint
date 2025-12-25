import { FolderOpen, Save, Plus, Play, Settings } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenExecutionMonitor: () => void;
}

export default function Sidebar({ onOpenSettings, onOpenExecutionMonitor }: SidebarProps) {
  const { project, loadProject, saveProject, createProject } = useProjectStore();

  return (
    <aside className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-2">
      <button
        onClick={createProject}
        className="p-3 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        title="New Project"
      >
        <Plus size={20} />
      </button>

      <button
        onClick={loadProject}
        className="p-3 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        title="Open Project"
      >
        <FolderOpen size={20} />
      </button>

      <button
        onClick={saveProject}
        disabled={!project}
        className="p-3 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Save Project"
      >
        <Save size={20} />
      </button>

      <div className="flex-1" />

      <button
        onClick={onOpenExecutionMonitor}
        disabled={!project || project.nodes.length === 0}
        className="p-3 rounded-lg hover:bg-gray-800 text-green-500 hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Generate All"
      >
        <Play size={20} />
      </button>

      <button
        onClick={onOpenSettings}
        className="p-3 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </aside>
  );
}
