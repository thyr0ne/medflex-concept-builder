import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { getChildNodes, getRootNode, getNodeTypeLabel } from '@/lib/assistant-utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function buildTextLines(nodes: AssistantNode[], nodeId: string, depth: number): string[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  const importantMarker = node.isImportant ? ' ⚠️ WICHTIG' : '';
  lines.push(`${indent}# ${getNodeTypeLabel(node.type).toUpperCase()}: ${node.title}${importantMarker}`);
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

  // Localized texts
  if (node.localizedTitles && Object.keys(node.localizedTitles).length > 0) {
    lines.push(`${indent}Übersetzungen Titel:`);
    Object.entries(node.localizedTitles).forEach(([lang, text]) => {
      if (text) lines.push(`${indent}  ${lang.toUpperCase()}: ${text}`);
    });
    lines.push('');
  }
  if (node.localizedAnsageTexts && Object.keys(node.localizedAnsageTexts).length > 0) {
    lines.push(`${indent}Übersetzungen Ansagetext:`);
    Object.entries(node.localizedAnsageTexts).forEach(([lang, text]) => {
      if (text) {
        lines.push(`${indent}  ${lang.toUpperCase()}:`);
        text.split('\n').forEach(l => lines.push(`${indent}    ${l}`));
      }
    });
    lines.push('');
  }

  lines.push(`${indent}Tag/Kanal: ${node.tag || 'Nein'}`);
  lines.push(`${indent}Auswahl mit Optionen: ${node.hasOptions ? 'Ja' : 'Nein'}`);
  if (node.hasOptions) {
    lines.push(`${indent}Eingabemodus: ${node.inputMode || 'keypress'}`);
  }

  if (node.hasOptions && node.options.length > 0) {
    lines.push('');
    lines.push(`${indent}Optionen:`);
    node.options.forEach(opt => {
      const keyPart = node.inputMode !== 'ai_keyword' ? `Tastendruck ${opt.key}: ` : '';
      const kwPart = (node.inputMode === 'ai_keyword' || node.inputMode === 'both') && opt.aiKeywords?.length
        ? ` [AI Schlagworte: ${opt.aiKeywords.join(', ')}]`
        : '';
      lines.push(`${indent}  ${keyPart}${opt.label}${kwPart}`);
    });
  }

  if (node.type === 'forward' && node.forwardNumber) {
    lines.push('');
    lines.push(`${indent}Weiterleitung an: ${node.forwardNumber}`);
    if (node.forwardRetrieveAfterSec) {
      lines.push(`${indent}Zurückholen nach: ${node.forwardRetrieveAfterSec} Sekunden`);
    }
    if (node.forwardFallbackText) {
      lines.push(`${indent}Fallback: ${node.forwardFallbackText}`);
    }
  }

  lines.push('');
  lines.push(`${indent}---`);
  lines.push('');

  const children = getChildNodes(nodes, nodeId);
  children.forEach(child => {
    const optionLabel = node.options.find(o => o.targetNodeId === child.id)?.label;
    if (optionLabel) {
      lines.push(`${indent}(bei Auswahl: ${optionLabel})`);
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

export function downloadJSON(config: AssistantConfig) {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TA_${config.praxisName.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPDF(config: AssistantConfig, flowchartElement: HTMLElement | null) {
  if (!flowchartElement) {
    console.error('Flowchart element not found');
    return;
  }

  try {
    const canvas = await html2canvas(flowchartElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Use custom page size matching the content
    const pdfWidthMm = (imgWidth / 2) * 0.264583; // px to mm at scale 2
    const pdfHeightMm = (imgHeight / 2) * 0.264583 + 30; // + header

    const doc = new jsPDF({
      orientation: pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [Math.max(pdfWidthMm, 210), Math.max(pdfHeightMm, 297)],
    });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Telefonassistent: ${config.praxisName}`, 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Stand: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`, 14, 22);
    doc.setTextColor(0);

    const finalWidth = imgWidth / 2 * 0.264583;
    const finalHeight = imgHeight / 2 * 0.264583;

    doc.addImage(imgData, 'PNG', 14, 28, finalWidth, finalHeight);

    doc.save(`TA_${config.praxisName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
  }
}
