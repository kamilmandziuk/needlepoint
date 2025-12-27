import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResizablePanelProps {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'left' | 'right';
  toolbar?: ReactNode;
}

export default function ResizablePanel({
  children,
  defaultWidth = 320,
  minWidth = 240,
  maxWidth = 600,
  side = 'right',
  toolbar,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const panelRect = panelRef.current.getBoundingClientRect();
      let newWidth: number;

      if (side === 'right') {
        newWidth = panelRect.right - e.clientX;
      } else {
        newWidth = e.clientX - panelRect.left;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth, side]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  if (isCollapsed) {
    return (
      <div className="w-10 bg-gray-900 border-l border-gray-800 flex flex-col items-center py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Expand Panel"
        >
          {side === 'right' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="relative flex flex-col bg-gray-900 border-l border-gray-800"
      style={{ width }}
    >
      {/* Resize handle - on left for right panel, on right for left panel */}
      <div
        className={`absolute ${side === 'right' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/50'
        }`}
        onMouseDown={startResizing}
      />

      {/* Toolbar header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-800">
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex items-center gap-1">
          {toolbar}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
