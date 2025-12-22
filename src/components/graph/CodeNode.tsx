import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FileCode,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Info,
  Unlink,
} from 'lucide-react';
import type { CodeNode as CodeNodeType, NodeStatus } from '../../lib/types';

const statusIcons: Record<NodeStatus, React.ReactNode> = {
  pending: <Circle size={12} className="text-gray-400" />,
  generating: <Loader2 size={12} className="text-blue-500 animate-spin" />,
  complete: <CheckCircle size={12} className="text-green-500" />,
  error: <XCircle size={12} className="text-red-500" />,
  warning: <AlertTriangle size={12} className="text-yellow-500" />,
};

const statusColors: Record<NodeStatus, string> = {
  pending: 'border-gray-600 bg-gray-800',
  generating: 'border-blue-500 bg-blue-900/30',
  complete: 'border-green-500 bg-green-900/30',
  error: 'border-red-500 bg-red-900/30',
  warning: 'border-yellow-500 bg-yellow-900/30',
};

const languageIcons: Record<string, string> = {
  typescript: 'TS',
  javascript: 'JS',
  python: 'PY',
  rust: 'RS',
  go: 'GO',
};

interface CodeNodeComponentProps {
  data: CodeNodeType & { isOrphan?: boolean };
  selected?: boolean;
}

interface ValidationIssue {
  type: 'warning' | 'info';
  message: string;
  icon: React.ReactNode;
}

function getValidationIssues(data: CodeNodeType & { isOrphan?: boolean }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!data.description || data.description.trim() === '') {
    issues.push({
      type: 'warning',
      message: 'Missing description',
      icon: <AlertTriangle size={10} />,
    });
  }

  if (!data.exports || data.exports.length === 0) {
    issues.push({
      type: 'info',
      message: 'No exports defined',
      icon: <Info size={10} />,
    });
  }

  if (data.isOrphan) {
    issues.push({
      type: 'warning',
      message: 'Orphan node (no connections)',
      icon: <Unlink size={10} />,
    });
  }

  return issues;
}

function CodeNodeComponent({ data, selected }: CodeNodeComponentProps) {
  const validationIssues = getValidationIssues(data);
  const hasWarnings = validationIssues.some((i) => i.type === 'warning');

  return (
    <div
      className={`
        min-w-[180px] rounded-lg border-2 shadow-lg transition-all relative
        ${statusColors[data.status]}
        ${selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}
      `}
    >
      {/* Validation badges */}
      {validationIssues.length > 0 && (
        <div className="absolute -top-2 -right-2 flex gap-0.5">
          {hasWarnings && (
            <div
              className="w-5 h-5 rounded-full bg-yellow-600 flex items-center justify-center text-white"
              title={validationIssues
                .filter((i) => i.type === 'warning')
                .map((i) => i.message)
                .join('\n')}
            >
              <AlertTriangle size={12} />
            </div>
          )}
          {validationIssues.some((i) => i.type === 'info') && !hasWarnings && (
            <div
              className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white"
              title={validationIssues
                .filter((i) => i.type === 'info')
                .map((i) => i.message)
                .join('\n')}
            >
              <Info size={12} />
            </div>
          )}
        </div>
      )}

      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-600 border-2 border-gray-400"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <FileCode size={14} className="text-gray-400" />
        <span className="text-xs font-mono text-gray-300 bg-gray-700 px-1.5 py-0.5 rounded">
          {languageIcons[data.language] || String(data.language).toUpperCase()}
        </span>
        <div className="flex-1" />
        {statusIcons[data.status]}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="font-medium text-white text-sm truncate">
          {data.name}
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          {data.filePath}
        </div>
        {data.description && (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {data.description}
          </div>
        )}
      </div>

      {/* Footer with exports and validation summary */}
      <div className="px-3 py-1.5 border-t border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {data.exports.length > 0
            ? `${data.exports.length} export${data.exports.length !== 1 ? 's' : ''}`
            : 'No exports'}
        </span>
        {validationIssues.length > 0 && (
          <div className="flex items-center gap-1">
            {validationIssues.map((issue, index) => (
              <span
                key={index}
                className={`${
                  issue.type === 'warning' ? 'text-yellow-500' : 'text-blue-400'
                }`}
                title={issue.message}
              >
                {issue.icon}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-600 border-2 border-gray-400"
      />
    </div>
  );
}

export default memo(CodeNodeComponent);
