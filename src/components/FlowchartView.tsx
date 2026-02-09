import { AssistantNode } from '@/types/assistant';
import { getChildNodes, getNodeTypeLabel } from '@/lib/assistant-utils';
import { Plus, Phone, MessageSquare, ArrowRight, XCircle, Mic, Volume2, FileAudio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, forwardRef } from 'react';

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

const NODE_HEIGHT = 130;
const NODE_WIDTH = 220;
const NODE_GAP_X = 24;
const NODE_GAP_Y = 50;

function calculateLayout(
  nodes: AssistantNode[],
  nodeId: string,
  depth: number = 0,
  startX: number = 0
): TreeLayout {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return { nodeId, x: startX, y: depth * (NODE_HEIGHT + NODE_GAP_Y), width: NODE_WIDTH, children: [] };

  const children = getChildNodes(nodes, nodeId);

  if (children.length === 0) {
    return {
      nodeId,
      x: startX,
      y: depth * (NODE_HEIGHT + NODE_GAP_Y),
      width: NODE_WIDTH,
      children: [],
    };
  }

  let currentX = startX;
  const childLayouts: TreeLayout[] = [];

  for (const child of children) {
    const childLayout = calculateLayout(nodes, child.id, depth + 1, currentX);
    childLayouts.push(childLayout);
    currentX += childLayout.width + NODE_GAP_X;
  }

  const totalChildrenWidth = currentX - startX - NODE_GAP_X;
  const width = Math.max(NODE_WIDTH, totalChildrenWidth);
  const x = startX + (totalChildrenWidth - NODE_WIDTH) / 2;

  return {
    nodeId,
    x: Math.max(startX, x),
    y: depth * (NODE_HEIGHT + NODE_GAP_Y),
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
  isPdfMode,
}: {
  node: AssistantNode;
  layout: TreeLayout;
  parentNode?: AssistantNode;
  isSelected: boolean;
  onSelect: () => void;
  onAddChild: () => void;
  isPdfMode?: boolean;
}) {
  const Icon = NODE_ICONS[node.type] || MessageSquare;
  const styles = NODE_STYLES[node.type] || NODE_STYLES.question;
  const optionLabel = parentNode?.options.find(o => o.targetNodeId === node.id)?.label;
  const ansagePreview = node.ansageText.length > 60 ? node.ansageText.substring(0, 60) + '...' : node.ansageText;

  return (
    <g>
      <foreignObject x={layout.x} y={layout.y} width={NODE_WIDTH} height={NODE_HEIGHT}>
        <div
          className={cn(
            'h-full rounded-xl border-2 p-2.5 cursor-pointer transition-all duration-150 shadow-sm relative',
            styles.bg,
            styles.border,
            !isPdfMode && 'hover:shadow-lg',
            !isPdfMode && isSelected && 'ring-2 ring-primary ring-offset-2 shadow-lg'
          )}
          onClick={onSelect}
        >
          {/* Option badge */}
          {optionLabel && (
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-foreground text-background text-[9px] font-bold rounded-full whitespace-nowrap">
              [{optionLabel}]
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={cn('w-3.5 h-3.5 shrink-0', styles.text)} />
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', styles.text)}>
              {getNodeTypeLabel(node.type)}
            </span>
            <div className="flex-1" />
            <span title={node.format === 'audiofile' ? 'Audiofile' : 'Synthetisch'}>
              {node.format === 'audiofile' ? (
                <FileAudio className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Volume2 className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          </div>

          {/* Title */}
          <div className="text-sm font-bold text-foreground leading-tight mb-1 truncate">
            {node.title}
          </div>

          {/* Ansage preview */}
          {ansagePreview && (
            <div className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mb-1">
              „{ansagePreview}"
            </div>
          )}

          {/* Tags & Info row */}
          <div className="flex items-center gap-1 flex-wrap mt-auto">
            {node.tag && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
                Tag: {node.tag}
              </span>
            )}
            {node.type === 'forward' && node.forwardNumber && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                → {node.forwardNumber}
              </span>
            )}
            {node.hasOptions && node.options.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {node.options.length} Optionen
              </span>
            )}
          </div>

          {/* Add child button */}
          {!isPdfMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(); }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
              title="Kind-Knoten hinzufügen"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

function ConnectionLines({ layout }: { layout: TreeLayout }) {
  const lines: JSX.Element[] = [];
  const parentCenterX = layout.x + NODE_WIDTH / 2;
  const parentBottomY = layout.y + NODE_HEIGHT;

  for (const child of layout.children) {
    const childCenterX = child.x + NODE_WIDTH / 2;
    const childTopY = child.y;

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

    lines.push(<ConnectionLines key={`conn-${child.nodeId}`} layout={child} />);
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
  isPdfMode,
}: {
  layout: TreeLayout;
  nodes: AssistantNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
  parentNode?: AssistantNode;
  isPdfMode?: boolean;
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
        isPdfMode={isPdfMode}
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
          isPdfMode={isPdfMode}
        />
      ))}
    </>
  );
}

interface FlowchartContentProps {
  nodes: AssistantNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
  isPdfMode?: boolean;
  praxisName?: string;
}

export const FlowchartContent = forwardRef<HTMLDivElement, FlowchartContentProps>(
  ({ nodes, selectedNodeId, onSelectNode, onAddChild, isPdfMode, praxisName }, ref) => {
    const rootNode = nodes.find(n => n.parentId === null);

    const layout = useMemo(() => {
      if (!rootNode) return null;
      return calculateLayout(nodes, rootNode.id, 0, 50);
    }, [nodes, rootNode]);

    if (!rootNode || !layout) {
      return <div className="p-8 text-muted-foreground">Kein Startknoten vorhanden.</div>;
    }

    const calculateBounds = (l: TreeLayout): { maxX: number; maxY: number } => {
      let maxX = l.x + NODE_WIDTH;
      let maxY = l.y + NODE_HEIGHT + 20;
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
      <div 
        ref={ref} 
        className={cn(
          'p-6',
          isPdfMode ? 'bg-background' : 'bg-gradient-to-br from-muted/30 to-muted/60'
        )}
        style={isPdfMode ? { width: svgWidth + 50, backgroundColor: '#fff' } : undefined}
      >
        {isPdfMode && praxisName && (
          <div className="mb-4">
            <h1 className="text-xl font-bold text-foreground">Telefonassistent: {praxisName}</h1>
            <p className="text-sm text-muted-foreground">Stand: {new Date().toLocaleDateString('de-DE')}</p>
          </div>
        )}
        <svg width={svgWidth} height={svgHeight}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--border))" />
            </marker>
          </defs>
          <ConnectionLines layout={layout} />
          <RenderNodes
            layout={layout}
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onAddChild={onAddChild}
            isPdfMode={isPdfMode}
          />
        </svg>
      </div>
    );
  }
);

FlowchartContent.displayName = 'FlowchartContent';

export default function FlowchartView({ nodes, selectedNodeId, onSelectNode, onAddChild }: FlowchartViewProps) {
  return (
    <div className="w-full h-full overflow-auto">
      <FlowchartContent
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onAddChild={onAddChild}
      />
    </div>
  );
}
