import { AssistantNode } from '@/types/assistant';
import { getChildNodes, getNodeTypeLabel } from '@/lib/assistant-utils';
import { ChevronRight, ChevronDown, Plus, Phone, MessageSquare, ArrowRight, XCircle, Mic } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TreeViewProps {
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

function TreeItem({
  node,
  nodes,
  depth,
  selectedNodeId,
  onSelectNode,
  onAddChild,
}: {
  node: AssistantNode;
  nodes: AssistantNode[];
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = getChildNodes(nodes, node.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const Icon = NODE_ICONS[node.type] || MessageSquare;

  // Find parent option label if this node is referenced
  const parent = nodes.find(n => n.id === node.parentId);
  const optionLabel = parent?.options.find(o => o.targetNodeId === node.id)?.label;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-colors text-sm',
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectNode(node.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4.5" />
        )}
        <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1">
          {optionLabel ? `[${optionLabel}] ` : ''}{node.title}
        </span>
        {node.tag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground shrink-0">
            {node.tag}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-primary/10 rounded transition-opacity"
          title="Kind-Knoten hinzufügen"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TreeView({ nodes, selectedNodeId, onSelectNode, onAddChild }: TreeViewProps) {
  const rootNode = nodes.find(n => n.parentId === null);
  if (!rootNode) return <div className="p-4 text-muted-foreground">Kein Startknoten vorhanden.</div>;

  return (
    <div className="py-2">
      <TreeItem
        node={rootNode}
        nodes={nodes}
        depth={0}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onAddChild={onAddChild}
      />
    </div>
  );
}
