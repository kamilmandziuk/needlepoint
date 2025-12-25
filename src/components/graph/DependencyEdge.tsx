import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
} from '@xyflow/react';
import type { CodeEdge } from '../../lib/types';

const EDGE_COLOR = '#60a5fa'; // blue

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

  const label = data?.label || '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: EDGE_COLOR,
          strokeWidth: selected ? 3 : 2,
          opacity: selected ? 1 : 0.7,
        }}
        markerEnd="url(#arrow-dependency)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`
              text-xs px-2 py-1 rounded-lg max-w-[180px] text-center
              ${selected ? 'bg-gray-700' : 'bg-gray-800/90'}
              border border-gray-600 text-gray-300
              whitespace-normal break-words
            `}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Arrow marker definition */}
      <svg style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <marker
            id="arrow-dependency"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR} />
          </marker>
        </defs>
      </svg>
    </>
  );
}

export default memo(DependencyEdgeComponent);
