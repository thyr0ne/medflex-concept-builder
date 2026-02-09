import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { v4 as uuidv4 } from 'uuid';

export function createDefaultConfig(): AssistantConfig {
  const rootId = uuidv4();
  return {
    id: uuidv4(),
    praxisName: 'Neue Praxis',
    nodes: [
      {
        id: rootId,
        parentId: null,
        type: 'greeting',
        title: 'Begrüßung',
        ansageText: 'Herzlich Willkommen bei der Praxis. Gerne nehmen wir Ihr Anliegen jetzt über unsere Telefonassistenz auf.',
        format: 'synthetic',
        hasOptions: false,
        options: [],
        order: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createNewNode(parentId: string, order: number): AssistantNode {
  return {
    id: uuidv4(),
    parentId,
    type: 'question',
    title: 'Neuer Schritt',
    ansageText: '',
    format: 'synthetic',
    hasOptions: false,
    options: [],
    order,
  };
}

export function insertNodeBefore(nodes: AssistantNode[], targetNodeId: string): { newNodes: AssistantNode[]; insertedNode: AssistantNode } {
  const target = nodes.find(n => n.id === targetNodeId);
  if (!target || !target.parentId) throw new Error('Cannot insert before root');

  const newNode: AssistantNode = {
    id: uuidv4(),
    parentId: target.parentId,
    type: 'question',
    title: 'Neuer Schritt',
    ansageText: '',
    format: 'synthetic',
    hasOptions: true,
    inputMode: 'keypress',
    options: [{ key: '1', label: target.title, targetNodeId: target.id, aiKeywords: [] }],
    order: target.order,
  };

  // Re-parent: target becomes child of newNode
  const newNodes = nodes.map(n => {
    if (n.id === target.id) {
      return { ...n, parentId: newNode.id };
    }
    return n;
  });

  // Update parent's options to point to newNode instead of target
  const updatedNodes = newNodes.map(n => {
    if (n.id === target.parentId) {
      return {
        ...n,
        options: n.options.map(o =>
          o.targetNodeId === targetNodeId ? { ...o, targetNodeId: newNode.id } : o
        ),
      };
    }
    return n;
  });

  return { newNodes: [...updatedNodes, newNode], insertedNode: newNode };
}

export function getChildNodes(nodes: AssistantNode[], parentId: string): AssistantNode[] {
  return nodes.filter(n => n.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function getRootNode(nodes: AssistantNode[]): AssistantNode | undefined {
  return nodes.find(n => n.parentId === null);
}

export function deleteNodeAndChildren(nodes: AssistantNode[], nodeId: string): AssistantNode[] {
  const childIds = nodes.filter(n => n.parentId === nodeId).map(n => n.id);
  let result = nodes.filter(n => n.id !== nodeId);
  for (const childId of childIds) {
    result = deleteNodeAndChildren(result, childId);
  }
  return result;
}

export function getNodePath(nodes: AssistantNode[], nodeId: string): AssistantNode[] {
  const path: AssistantNode[] = [];
  let current = nodes.find(n => n.id === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return path;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  greeting: 'Begrüßung',
  question: 'Frage',
  action: 'Aktion',
  end: 'Schluss',
  forward: 'Weiterleitung',
};

export function getNodeTypeLabel(type: string): string {
  return NODE_TYPE_LABELS[type] || type;
}
