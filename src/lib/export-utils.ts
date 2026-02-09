import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { getChildNodes, getRootNode, getNodeTypeLabel } from '@/lib/assistant-utils';
import jsPDF from 'jspdf';

// Inline color styles for PDF (no Tailwind in html2canvas)
const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  greeting: { bg: '#e8f0fe', border: '#3b82d6', text: '#1e4a8a' },
  question: { bg: '#fef9e7', border: '#d4a017', text: '#6b4e0a' },
  action: { bg: '#e6f7f0', border: '#3a9d72', text: '#1a5c41' },
  end: { bg: '#fce8e8', border: '#d44848', text: '#8a1e1e' },
  forward: { bg: '#f3e8fc', border: '#8b4ed6', text: '#4e1e8a' },
};

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

// --- PDF Export: Pure jsPDF renderer (no html2canvas) ---

const PDF_MARGIN = 20; // mm
const PDF_NODE_W = 70; // mm
const PDF_NODE_GAP_X = 10; // mm
const PDF_NODE_GAP_Y = 15; // mm
const PDF_FONT_SIZE = 8;
const PDF_TITLE_SIZE = 10;
const PDF_HEADER_SIZE = 7;

const PDF_COLORS: Record<string, { bg: [number, number, number]; border: [number, number, number]; text: [number, number, number] }> = {
  greeting: { bg: [232, 240, 254], border: [59, 130, 214], text: [30, 74, 138] },
  question: { bg: [254, 249, 231], border: [212, 160, 23], text: [107, 78, 10] },
  action: { bg: [230, 247, 240], border: [58, 157, 114], text: [26, 92, 65] },
  end: { bg: [252, 232, 232], border: [212, 72, 72], text: [138, 30, 30] },
  forward: { bg: [243, 232, 252], border: [139, 78, 214], text: [78, 30, 138] },
};

interface PdfNodeLayout {
  nodeId: string;
  x: number;
  y: number;
  height: number;
  subtreeWidth: number;
  children: PdfNodeLayout[];
}

function wrapText(text: string, maxWidth: number, doc: jsPDF): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(test) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function measureNodeHeight(node: AssistantNode, doc: jsPDF): number {
  const contentWidth = PDF_NODE_W - 6;
  let h = 12; // header + title baseline
  
  // Title
  doc.setFontSize(PDF_TITLE_SIZE);
  const titleLines = wrapText(node.title, contentWidth, doc);
  h += titleLines.length * 4;

  // Ansage text
  if (node.ansageText) {
    doc.setFontSize(PDF_FONT_SIZE);
    const lines = wrapText(node.ansageText, contentWidth, doc);
    h += lines.length * 3.2 + 2;
  }

  // Options
  if (node.hasOptions && node.options.length > 0) {
    h += 4 + node.options.length * 3.5;
  }

  // Tags / forward
  if (node.tag || node.forwardNumber || node.isImportant) h += 5;

  return Math.max(20, h + 3);
}

function layoutPdfTree(nodes: AssistantNode[], nodeId: string, x: number, y: number, doc: jsPDF): PdfNodeLayout {
  const node = nodes.find(n => n.id === nodeId);
  const height = node ? measureNodeHeight(node, doc) : 20;
  const children = node ? getChildNodes(nodes, nodeId) : [];

  if (children.length === 0) {
    return { nodeId, x, y, height, subtreeWidth: PDF_NODE_W, children: [] };
  }

  let currentX = x;
  const childLayouts: PdfNodeLayout[] = [];
  const childY = y + height + PDF_NODE_GAP_Y;
  for (const child of children) {
    const cl = layoutPdfTree(nodes, child.id, currentX, childY, doc);
    childLayouts.push(cl);
    currentX += cl.subtreeWidth + PDF_NODE_GAP_X;
  }

  const totalWidth = currentX - x - PDF_NODE_GAP_X;
  const subtreeWidth = Math.max(PDF_NODE_W, totalWidth);
  // Center this node over its children
  const centerX = x + (totalWidth - PDF_NODE_W) / 2;

  return { nodeId, x: Math.max(x, centerX), y, height, subtreeWidth, children: childLayouts };
}

function drawNode(doc: jsPDF, node: AssistantNode, layout: PdfNodeLayout, parentNode?: AssistantNode) {
  const colors = PDF_COLORS[node.type] || PDF_COLORS.question;
  const inputMode = node.inputMode || 'keypress';

  // Background
  doc.setFillColor(...colors.bg);
  doc.roundedRect(layout.x, layout.y, PDF_NODE_W, layout.height, 2, 2, 'F');
  // Border
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(layout.x, layout.y, PDF_NODE_W, layout.height, 2, 2, 'S');

  // Important ring
  if (node.isImportant) {
    doc.setDrawColor(250, 204, 21);
    doc.setLineWidth(0.8);
    doc.roundedRect(layout.x - 1, layout.y - 1, PDF_NODE_W + 2, layout.height + 2, 3, 3, 'S');
  }

  // Option badge from parent
  const optionLabel = parentNode?.options.find(o => o.targetNodeId === node.id)?.label;
  const optionKey = parentNode?.options.find(o => o.targetNodeId === node.id)?.key;
  if (optionLabel) {
    const badgeText = (optionKey && inputMode !== 'ai_keyword' ? `[${optionKey}] ` : '') + optionLabel;
    doc.setFontSize(6);
    const bw = doc.getTextWidth(badgeText) + 4;
    const bx = layout.x + PDF_NODE_W / 2 - bw / 2;
    doc.setFillColor(26, 26, 46);
    doc.roundedRect(bx, layout.y - 3, bw, 5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, layout.x + PDF_NODE_W / 2, layout.y - 0.5, { align: 'center' });
  }

  let curY = layout.y + 4;
  const contentWidth = PDF_NODE_W - 6;
  const lx = layout.x + 3;

  // Type header
  doc.setFontSize(PDF_HEADER_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.text);
  doc.text(getNodeTypeLabel(node.type).toUpperCase(), lx, curY);
  curY += 4;

  // Title
  doc.setFontSize(PDF_TITLE_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  const titleLines = wrapText(node.title, contentWidth, doc);
  for (const line of titleLines) {
    doc.text(line, lx, curY);
    curY += 4;
  }

  // Ansage
  if (node.ansageText) {
    curY += 1;
    doc.setFontSize(PDF_FONT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const lines = wrapText(`„${node.ansageText}"`, contentWidth, doc);
    for (const line of lines) {
      doc.text(line, lx, curY);
      curY += 3.2;
    }
  }

  // Options
  if (node.hasOptions && node.options.length > 0) {
    curY += 2;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('OPTIONEN', lx, curY);
    curY += 3;
    doc.setFontSize(PDF_FONT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 26, 46);
    for (const opt of node.options) {
      const prefix = inputMode !== 'ai_keyword' ? `[${opt.key}] ` : '';
      doc.text(`${prefix}${opt.label}`, lx + 1, curY);
      curY += 3.5;
    }
  }

  // Tags
  if (node.tag) {
    curY += 1;
    doc.setFontSize(6);
    doc.setTextColor(3, 105, 161);
    doc.text(`Tag: ${node.tag}`, lx, curY);
    curY += 3;
  }
  if (node.type === 'forward' && node.forwardNumber) {
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text(`→ ${node.forwardNumber}`, lx, curY);
  }
}

function drawTree(doc: jsPDF, nodes: AssistantNode[], layout: PdfNodeLayout, parentNode?: AssistantNode) {
  const node = nodes.find(n => n.id === layout.nodeId);
  if (!node) return;

  drawNode(doc, node, layout, parentNode);

  // Draw connection lines to children
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  for (const child of layout.children) {
    const fromX = layout.x + PDF_NODE_W / 2;
    const fromY = layout.y + layout.height;
    const toX = child.x + PDF_NODE_W / 2;
    const toY = child.y;
    // Simple straight line
    doc.line(fromX, fromY, toX, toY);
    drawTree(doc, nodes, child, node);
  }
}

export async function downloadPDF(config: AssistantConfig) {
  const root = getRootNode(config.nodes);
  if (!root) throw new Error('No root node found');

  // Create a temporary doc to measure text
  const tempDoc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = layoutPdfTree(config.nodes, root.id, PDF_MARGIN, PDF_MARGIN + 12, tempDoc);

  // Calculate total bounds
  function getBounds(l: PdfNodeLayout): { maxX: number; maxY: number } {
    let maxX = l.x + PDF_NODE_W;
    let maxY = l.y + l.height;
    for (const c of l.children) {
      const cb = getBounds(c);
      maxX = Math.max(maxX, cb.maxX);
      maxY = Math.max(maxY, cb.maxY);
    }
    return { maxX, maxY };
  }

  const bounds = getBounds(layout);
  const pageW = Math.max(210, bounds.maxX + PDF_MARGIN);
  const pageH = Math.max(297, bounds.maxY + PDF_MARGIN);

  const doc = new jsPDF({
    orientation: pageW > pageH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageW, pageH],
  });

  // Re-layout with final doc for accurate measurements  
  const finalLayout = layoutPdfTree(config.nodes, root.id, PDF_MARGIN, PDF_MARGIN + 12, doc);

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text(`Telefonassistent: ${config.praxisName}`, PDF_MARGIN, PDF_MARGIN + 4);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Stand: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`, PDF_MARGIN, PDF_MARGIN + 8);

  // Draw tree
  drawTree(doc, config.nodes, finalLayout);

  doc.save(`TA_${config.praxisName.replace(/\s+/g, '_')}.pdf`);
}
