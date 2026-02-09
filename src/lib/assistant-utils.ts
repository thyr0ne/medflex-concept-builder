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
