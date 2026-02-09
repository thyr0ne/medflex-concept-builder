import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { getChildNodes, getRootNode, getNodeTypeLabel } from '@/lib/assistant-utils';
import jsPDF from 'jspdf';

function buildTextLines(nodes: AssistantNode[], nodeId: string, depth: number): string[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  lines.push(`${indent}# ${getNodeTypeLabel(node.type).toUpperCase()}: ${node.title}`);
  lines.push('');
  if (node.format === 'audiofile' && node.audioFileName) {
    lines.push(`${indent}Format: Audiofile (${node.audioFileName})`);
  } else {
    lines.push(`${indent}Format: synthetisch`);
  }
  lines.push('');
  if (node.ansageText) {
    lines.push(`${indent}Ansage:`);
    node.ansageText.split('\n').forEach(l => lines.push(`${indent}  ${l}`));
    lines.push('');
  }
  lines.push(`${indent}Tag/Kanal: ${node.tag || 'Nein'}`);
  lines.push(`${indent}Auswahl mit Optionen: ${node.hasOptions ? 'Ja' : 'Nein'}`);

  if (node.hasOptions && node.options.length > 0) {
    lines.push('');
    lines.push(`${indent}Optionen:`);
    node.options.forEach(opt => {
      lines.push(`${indent}  Tastendruck ${opt.key}: ${opt.label}`);
    });
  }

  if (node.type === 'forward' && node.forwardNumber) {
    lines.push('');
    lines.push(`${indent}Weiterleitung an: ${node.forwardNumber}`);
    if (node.forwardFallbackText) {
      lines.push(`${indent}Fallback: ${node.forwardFallbackText}`);
    }
  }

  lines.push('');
  lines.push(`${indent}---`);
  lines.push('');

  // Recurse children
  const children = getChildNodes(nodes, nodeId);
  children.forEach(child => {
    const optionLabel = node.options.find(o => o.targetNodeId === child.id)?.label;
    if (optionLabel) {
      lines.push(`${indent}(bei Tastendruck: ${optionLabel})`);
      lines.push('');
    }
    lines.push(...buildTextLines(nodes, child.id, depth + 1));
  });

  return lines;
}

export function exportToText(config: AssistantConfig): string {
  const lines: string[] = [];
  lines.push(`TELEFONASSISTENT KONFIGURATION`);
  lines.push(`Praxis: ${config.praxisName}`);
  lines.push(`Erstellt: ${new Date(config.createdAt).toLocaleDateString('de-DE')}`);
  lines.push(`Aktualisiert: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  const root = getRootNode(config.nodes);
  if (root) {
    lines.push(...buildTextLines(config.nodes, root.id, 0));
  }

  return lines.join('\n');
}

export function downloadText(config: AssistantConfig) {
  const text = exportToText(config);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TA_${config.praxisName.replace(/\s+/g, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPDF(config: AssistantConfig) {
  const doc = new jsPDF();
  const text = exportToText(config);
  const lines = text.split('\n');
  
  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text(`Telefonassistent: ${config.praxisName}`, 14, 20);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Stand: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`, 14, 28);
  
  doc.setTextColor(0);
  doc.setFontSize(10);
  
  let y = 38;
  const pageHeight = doc.internal.pageSize.height - 20;
  
  for (const line of lines) {
    if (y > pageHeight) {
      doc.addPage();
      y = 20;
    }
    
    if (line.startsWith('#') || line.includes('KONFIGURATION')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }
    
    // Wrap long lines
    const maxWidth = 180;
    const wrappedLines = doc.splitTextToSize(line || ' ', maxWidth);
    for (const wl of wrappedLines) {
      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }
      doc.text(wl, 14, y);
      y += 5;
    }
  }
  
  doc.save(`TA_${config.praxisName.replace(/\s+/g, '_')}.pdf`);
}
