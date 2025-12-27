import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import LeftPanel from './components/layout/LeftPanel';
import Canvas from './components/layout/Canvas';
import PropertiesPanel from './components/layout/PropertiesPanel';
import ResizablePanel from './components/layout/ResizablePanel';
import RightPanelToolbar from './components/layout/RightPanelToolbar';
import SettingsPanel from './components/settings/SettingsPanel';
import ExecutionMonitor from './components/execution/ExecutionMonitor';
import ToastContainer from './components/ui/Toast';
import { useSettingsStore } from './stores/settingsStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false);
  const { loadSettings } = useSettingsStore();

  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  // Load settings on app startup
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full bg-canvas-bg">
        <LeftPanel
          onOpenSettings={() => setShowSettings(true)}
          onOpenExecutionMonitor={() => setShowExecutionMonitor(true)}
        />
        <Canvas />
        <ResizablePanel
          defaultWidth={320}
          minWidth={240}
          maxWidth={600}
          toolbar={<RightPanelToolbar />}
        >
          <PropertiesPanel />
        </ResizablePanel>
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {showExecutionMonitor && (
        <ExecutionMonitor onClose={() => setShowExecutionMonitor(false)} />
      )}

      <ToastContainer />
    </ReactFlowProvider>
  );
}

export default App;
