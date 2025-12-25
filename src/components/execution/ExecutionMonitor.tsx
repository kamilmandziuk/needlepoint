import { useRef, useEffect } from 'react';
import { X, Play, Square, Trash2, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useExecutionStore, type ExecutionStatus } from '../../stores/executionStore';

interface ExecutionMonitorProps {
  onClose: () => void;
}

export default function ExecutionMonitor({ onClose }: ExecutionMonitorProps) {
  const {
    status,
    currentWave,
    totalWaves,
    completedNodes,
    totalNodes,
    failedNodes,
    logs,
    error,
    startExecution,
    cancelExecution,
    clearLogs,
    reset,
  } = useExecutionStore();

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

  const getStatusIcon = (s: ExecutionStatus) => {
    switch (s) {
      case 'idle':
        return <Play className="w-4 h-4" />;
      case 'planning':
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (s: ExecutionStatus) => {
    switch (s) {
      case 'idle':
        return 'Ready';
      case 'planning':
        return 'Planning...';
      case 'running':
        return `Running (Wave ${currentWave}/${totalWaves})`;
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'error':
        return 'Error';
    }
  };

  const getLogIcon = (type: 'info' | 'success' | 'error' | 'warning') => {
    switch (type) {
      case 'info':
        return <span className="text-blue-400">i</span>;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
    }
  };

  const isRunning = status === 'planning' || status === 'running';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Execution Monitor</h2>
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm">
              {getStatusIcon(status)}
              <span className="text-gray-300">{getStatusText(status)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-gray-400">
              {completedNodes} / {totalNodes} nodes
            </span>
            <span className="text-gray-400">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                failedNodes.length > 0 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {failedNodes.length > 0 && (
            <p className="mt-1 text-sm text-red-400">
              {failedNodes.length} failed
            </p>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px] max-h-[400px] font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Click "Start" to begin generation
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 py-1 ${
                  log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
                <span className="text-gray-500 flex-shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 py-3 border-t border-gray-700 bg-red-900/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            onClick={clearLogs}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={cancelExecution}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <>
                {(status === 'completed' || status === 'error' || status === 'cancelled') && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white border border-gray-600 rounded transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={startExecution}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {status === 'idle' ? 'Start' : 'Retry'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
