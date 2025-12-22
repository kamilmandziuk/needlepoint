import { ReactFlowProvider } from '@xyflow/react';
import Sidebar from './components/layout/Sidebar';
import Canvas from './components/layout/Canvas';
import PropertiesPanel from './components/layout/PropertiesPanel';

function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full bg-canvas-bg">
        <Sidebar />
        <Canvas />
        <PropertiesPanel />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
