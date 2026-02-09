import { AssistantNode } from '@/types/assistant';
import { getChildNodes, getNodeTypeLabel } from '@/lib/assistant-utils';
import { Plus, Phone, MessageSquare, ArrowRight, XCircle, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface FlowchartViewProps {
  nodes: AssistantNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

const NODE_ICONS: Record<string, React.ElementType> = {
  greeting: Mic,
  question: MessageSquare,
  action: Phone,
  end: XCircle,
  forward: ArrowRight,
};

const NODE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  greeting: { bg: 'bg-node-greeting', border: 'border-node-greeting-border', text: 'text-node-greeting-foreground' },
  question: { bg: 'bg-node-question', border: 'border-node-question-border', text: 'text-node-question-foreground' },
  action: { bg: 'bg-node-action', border: 'border-node-action-border', text: 'text-node-action-foreground' },
  end: { bg: 'bg-node-end', border: 'border-node-end-border', text: 'text-node-end-foreground' },
  forward: { bg: 'bg-node-forward', border: 'border-node-forward-border', text: 'text-node-forward-foreground' },
};

interface TreeLayout {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  children: TreeLayout[];
}

function calculateLayout(
  nodes: AssistantNode[],
  nodeId: string,
  depth: number = 0,
  startX: number = 0
): TreeLayout {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return { nodeId, x: startX, y: depth * 140, width: 200, children: [] };

  const children = getChildNodes(nodes, nodeId);
  const nodeWidth = 200;
  const nodeGap = 32;

  if (children.length === 0) {
    return {
      nodeId,
      x: startX,
      y: depth * 140,
      width: nodeWidth,
      children: [],
    };
  }

  // Calculate children layouts
  let currentX = startX;
  const childLayouts: TreeLayout[] = [];

  for (const child of children) {
    const childLayout = calculateLayout(nodes, child.id, depth + 1, currentX);
    childLayouts.push(childLayout);
    currentX += childLayout.width + nodeGap;
  }

  // Total width is sum of children widths + gaps
  const totalChildrenWidth = currentX - startX - nodeGap;
  const width = Math.max(nodeWidth, totalChildrenWidth);

  // Center this node above its children
  const x = startX + (totalChildrenWidth - nodeWidth) / 2;

  return {
    nodeId,
    x: Math.max(startX, x),
    y: depth * 140,
    width,
    children: childLayouts,
  };
}

function FlowchartNode({
  node,
  layout,
  parentNode,
  isSelected,
  onSelect,
  onAddChild,
}: {
  node: AssistantNode;
  layout: TreeLayout;
  parentNode?: AssistantNode;
  isSelected: boolean;
  onSelect: () => void;
  onAddChild: () => void;
}) {
  const Icon = NODE_ICONS[node.type] || MessageSquare;
  const styles = NODE_STYLES[node.type] || NODE_STYLES.question;

  // Find option label from parent
  const optionLabel = parentNode?.options.find(o => o.targetNodeId === node.id)?.label;

  return (
    <g>
      <foreignObject x={layout.x} y={layout.y} width={200} height={100}>
        <div
          className={cn(
            'h-full rounded-xl border-2 p-3 cursor-pointer transition-all duration-150 shadow-sm hover:shadow-lg relative',
            styles.bg,
            styles.border,
            isSelected && 'ring-2 ring-primary ring-offset-2 shadow-lg'
          )}
          onClick={onSelect}
        >
          {/* Option badge */}
          {optionLabel && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-foreground text-background text-[10px] font-medium rounded-full whitespace-nowrap">
              Taste: {optionLabel}
            </div>
          )}

          <div className="flex items-start gap-2">
            <div className={cn('p-1.5 rounded-lg', styles.bg, styles.text)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn('text-xs font-medium mb-0.5', styles.text)}>
                {getNodeTypeLabel(node.type)}
              </div>
              <div className="text-sm font-semibold text-foreground truncate">
                {node.title}
              </div>
              {node.tag && (
                <div className="mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                    {node.tag}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Add child button */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
            title="Kind-Knoten hinzufügen"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </foreignObject>
    </g>
  );
}

function ConnectionLines({
  layout,
  nodes,
}: {
  layout: TreeLayout;
  nodes: AssistantNode[];
}) {
  const lines: JSX.Element[] = [];
  const parentCenterX = layout.x + 100;
  const parentBottomY = layout.y + 100;

  for (const child of layout.children) {
    const childCenterX = child.x + 100;
    const childTopY = child.y;

    // Draw curved connection line
    const midY = (parentBottomY + childTopY) / 2;
    const path = `M ${parentCenterX} ${parentBottomY + 12} 
                  C ${parentCenterX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${childTopY - 8}`;

    lines.push(
      <path
        key={child.nodeId}
        d={path}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
    );

    // Recurse for grandchildren
    lines.push(
      <ConnectionLines key={`conn-${child.nodeId}`} layout={child} nodes={nodes} />
    );
  }

  return <>{lines}</>;
}

function RenderNodes({
  layout,
  nodes,
  selectedNodeId,
  onSelectNode,
  onAddChild,
  parentNode,
}: {
  layout: TreeLayout;
  nodes: AssistantNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
  parentNode?: AssistantNode;
}) {
  const node = nodes.find(n => n.id === layout.nodeId);
  if (!node) return null;

  return (
    <>
      <FlowchartNode
        node={node}
        layout={layout}
        parentNode={parentNode}
        isSelected={selectedNodeId === node.id}
        onSelect={() => onSelectNode(node.id)}
        onAddChild={() => onAddChild(node.id)}
      />
      {layout.children.map(childLayout => (
        <RenderNodes
          key={childLayout.nodeId}
          layout={childLayout}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onAddChild={onAddChild}
          parentNode={node}
        />
      ))}
    </>
  );
}

export default function FlowchartView({ nodes, selectedNodeId, onSelectNode, onAddChild }: FlowchartViewProps) {
  const rootNode = nodes.find(n => n.parentId === null);

  const layout = useMemo(() => {
    if (!rootNode) return null;
    return calculateLayout(nodes, rootNode.id, 0, 50);
  }, [nodes, rootNode]);

  if (!rootNode || !layout) {
    return <div className="p-8 text-muted-foreground">Kein Startknoten vorhanden.</div>;
  }

  // Calculate SVG dimensions
  const calculateBounds = (l: TreeLayout): { maxX: number; maxY: number } => {
    let maxX = l.x + 200;
    let maxY = l.y + 120;
    for (const child of l.children) {
      const childBounds = calculateBounds(child);
      maxX = Math.max(maxX, childBounds.maxX);
      maxY = Math.max(maxY, childBounds.maxY);
    }
    return { maxX, maxY };
  };

  const bounds = calculateBounds(layout);
  const svgWidth = Math.max(bounds.maxX + 50, 600);
  const svgHeight = Math.max(bounds.maxY + 50, 400);

  return (
    <div className="w-full h-full overflow-auto bg-gradient-to-br from-muted/30 to-muted/60 p-4">
      <svg width={svgWidth} height={svgHeight} className="min-w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--border))"
            />
          </marker>
        </defs>

        {/* Connection lines first (behind nodes) */}
        <ConnectionLines layout={layout} nodes={nodes} />

        {/* Nodes */}
        <RenderNodes
          layout={layout}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onAddChild={onAddChild}
        />
      </svg>
    </div>
  );
}
