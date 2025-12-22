import { memo, useEffect, useRef } from 'react';
import { Trash2, Copy, Play, Settings } from 'lucide-react';

export interface ContextMenuOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

function ContextMenuComponent({ x, y, options, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px] z-50"
      style={{ left: x, top: y }}
    >
      {options.map((option, index) => (
        <button
          key={index}
          className={`
            w-full px-3 py-2 text-left text-sm flex items-center gap-2
            ${option.danger
              ? 'text-red-400 hover:bg-red-900/30'
              : 'text-gray-200 hover:bg-gray-700'}
            transition-colors
          `}
          onClick={() => {
            option.onClick();
            onClose();
          }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default memo(ContextMenuComponent);

// Helper to create common node context menu options
export function createNodeContextMenuOptions(
  nodeId: string,
  onDelete: (id: string) => void,
  onDuplicate: (id: string) => void,
  onGenerate: (id: string) => void,
  onSettings: (id: string) => void
): ContextMenuOption[] {
  return [
    {
      label: 'Generate Code',
      icon: <Play size={14} />,
      onClick: () => onGenerate(nodeId),
    },
    {
      label: 'Duplicate',
      icon: <Copy size={14} />,
      onClick: () => onDuplicate(nodeId),
    },
    {
      label: 'Settings',
      icon: <Settings size={14} />,
      onClick: () => onSettings(nodeId),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(nodeId),
      danger: true,
    },
  ];
}

// Helper to create common edge context menu options
export function createEdgeContextMenuOptions(
  edgeId: string,
  onDelete: (id: string) => void,
  onChangeType: (id: string) => void
): ContextMenuOption[] {
  return [
    {
      label: 'Change Type',
      icon: <Settings size={14} />,
      onClick: () => onChangeType(edgeId),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(edgeId),
      danger: true,
    },
  ];
}
