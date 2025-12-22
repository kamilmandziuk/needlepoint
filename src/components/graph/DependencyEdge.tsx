import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
} from '@xyflow/react';
import type { CodeEdge, EdgeType } from '../../lib/types';

const edgeTypeColors: Record<EdgeType, string> = {
  imports: '#60a5fa', // blue
  implements: '#a78bfa', // purple
  extends: '#f472b6', // pink
  calls: '#34d399', // green
  uses: '#fbbf24', // yellow
};

const edgeTypeLabels: Record<EdgeType, string> = {
  imports: 'imports',
  implements: 'implements',
  extends: 'extends',
  calls: 'calls',
  uses: 'uses',
};

interface DependencyEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: CodeEdge;
  selected?: boolean;
}

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: DependencyEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.type ?? 'imports';
  const color = edgeTypeColors[edgeType];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          opacity: selected ? 1 : 0.7,
        }}
        markerEnd={`url(#arrow-${edgeType})`}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`
            text-xs px-2 py-0.5 rounded-full
            ${selected ? 'bg-gray-700' : 'bg-gray-800/80'}
            border border-gray-600
          `}
        >
          <span style={{ color }}>{edgeTypeLabels[edgeType]}</span>
        </div>
      </EdgeLabelRenderer>

      {/* Arrow marker definitions */}
      <svg style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          {Object.entries(edgeTypeColors).map(([type, markerColor]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={markerColor} />
            </marker>
          ))}
        </defs>
      </svg>
    </>
  );
}

export default memo(DependencyEdgeComponent);
