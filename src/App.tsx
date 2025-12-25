import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import Sidebar from './components/layout/Sidebar';
import Canvas from './components/layout/Canvas';
import PropertiesPanel from './components/layout/PropertiesPanel';
import SettingsPanel from './components/settings/SettingsPanel';
import ExecutionMonitor from './components/execution/ExecutionMonitor';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false);
  const { loadSettings } = useSettingsStore();

  // Load settings on app startup
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full bg-canvas-bg">
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          onOpenExecutionMonitor={() => setShowExecutionMonitor(true)}
        />
        <Canvas />
        <PropertiesPanel />
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {showExecutionMonitor && (
        <ExecutionMonitor onClose={() => setShowExecutionMonitor(false)} />
      )}
    </ReactFlowProvider>
  );
}

export default App;
