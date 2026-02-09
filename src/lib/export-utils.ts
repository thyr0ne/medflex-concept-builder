import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { getChildNodes, getRootNode, getNodeTypeLabel } from '@/lib/assistant-utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export async function downloadPDF(config: AssistantConfig, flowchartElement: HTMLElement | null) {
  if (!flowchartElement) {
    console.error('Flowchart element not found');
    return;
  }

  try {
    // Create canvas from the flowchart
    const canvas = await html2canvas(flowchartElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Calculate PDF dimensions (A4 landscape or portrait based on aspect ratio)
    const aspectRatio = imgWidth / imgHeight;
    let pdfWidth: number;
    let pdfHeight: number;
    let orientation: 'portrait' | 'landscape';

    if (aspectRatio > 1.2) {
      // Wide flowchart - use landscape
      orientation = 'landscape';
      pdfWidth = 297; // A4 landscape width in mm
      pdfHeight = 210; // A4 landscape height in mm
    } else {
      // Tall or square - use portrait
      orientation = 'portrait';
      pdfWidth = 210; // A4 portrait width in mm
      pdfHeight = 297; // A4 portrait height in mm
    }

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    // Add title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Telefonassistent: ${config.praxisName}`, 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Stand: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`, 14, 22);
    doc.setTextColor(0);

    // Calculate image size to fit on page with margins
    const margin = 14;
    const availableWidth = pdfWidth - (margin * 2);
    const availableHeight = pdfHeight - 30 - margin; // 30mm for header

    const scale = Math.min(
      availableWidth / (imgWidth / 2), // divide by 2 because we scaled canvas by 2
      availableHeight / (imgHeight / 2)
    );

    const finalWidth = (imgWidth / 2) * scale;
    const finalHeight = (imgHeight / 2) * scale;

    // Center the image
    const x = margin + (availableWidth - finalWidth) / 2;
    const y = 28;

    doc.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

    doc.save(`TA_${config.praxisName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
  }
}
