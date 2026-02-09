import { useState, useCallback } from 'react';
import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { createDefaultConfig, createNewNode, deleteNodeAndChildren } from '@/lib/assistant-utils';

const STORAGE_KEY = 'medflex-ta-config';

function loadConfig(): AssistantConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return createDefaultConfig();
}

export function useAssistantConfig() {
  const [config, setConfig] = useState<AssistantConfig>(loadConfig);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => config.nodes[0]?.id || null
  );

  const saveConfig = useCallback((newConfig: AssistantConfig) => {
    newConfig.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
  }, []);

  const updatePraxisName = useCallback((name: string) => {
    saveConfig({ ...config, praxisName: name });
  }, [config, saveConfig]);

  const updateNode = useCallback((updatedNode: AssistantNode) => {
    const newNodes = config.nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
    saveConfig({ ...config, nodes: newNodes });
  }, [config, saveConfig]);

  const addChildNode = useCallback((parentId: string) => {
    const siblings = config.nodes.filter(n => n.parentId === parentId);
    const newNode = createNewNode(parentId, siblings.length);
    const newNodes = [...config.nodes, newNode];
    saveConfig({ ...config, nodes: newNodes });
    setSelectedNodeId(newNode.id);
    return newNode;
  }, [config, saveConfig]);

  const deleteNode = useCallback((nodeId: string) => {
    const node = config.nodes.find(n => n.id === nodeId);
    if (!node || !node.parentId) return; // can't delete root
    const newNodes = deleteNodeAndChildren(config.nodes, nodeId);
    // Also remove from parent options
    const parent = newNodes.find(n => n.id === node.parentId);
    if (parent) {
      parent.options = parent.options.filter(o => o.targetNodeId !== nodeId);
    }
    saveConfig({ ...config, nodes: newNodes });
    setSelectedNodeId(node.parentId);
  }, [config, saveConfig]);

  const resetConfig = useCallback(() => {
    const newConfig = createDefaultConfig();
    saveConfig(newConfig);
    setSelectedNodeId(newConfig.nodes[0]?.id || null);
  }, [saveConfig]);

  const selectedNode = config.nodes.find(n => n.id === selectedNodeId) || null;

  return {
    config,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    updatePraxisName,
    updateNode,
    addChildNode,
    deleteNode,
    resetConfig,
    saveConfig,
  };
}
