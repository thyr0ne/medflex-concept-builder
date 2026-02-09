import { AssistantConfig, AssistantNode } from '@/types/assistant';
import { getChildNodes, getRootNode, getNodeTypeLabel } from '@/lib/assistant-utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

// --- PDF Export: Pure HTML renderer with inline styles ---

const PDF_NODE_WIDTH = 340;
const PDF_CHARS_PER_LINE = 48;
const PDF_NODE_GAP_X = 32;
const PDF_NODE_GAP_Y = 55;
const PDF_NODE_MIN_HEIGHT = 110;

interface PdfLayout {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: PdfLayout[];
}

function estimatePdfNodeHeight(node: AssistantNode): number {
  let h = 80;
  if (node.ansageText) {
    h += Math.ceil(node.ansageText.length / PDF_CHARS_PER_LINE) * 14 + 6;
  }
  const localizedTexts = node.localizedAnsageTexts || {};
  const localizedTitles = node.localizedTitles || {};
  const langs = new Set([...Object.keys(localizedTexts), ...Object.keys(localizedTitles)]);
  for (const lang of langs) {
    h += 20;
    if (localizedTitles[lang]) h += 16;
    const txt = localizedTexts[lang];
    if (txt) h += Math.ceil(txt.length / PDF_CHARS_PER_LINE) * 13 + 4;
  }
  const extraLines = (node.tag ? 1 : 0) + (node.forwardNumber ? 1 : 0) + (node.isImportant ? 1 : 0);
  if (extraLines > 0) h += 22;
  if (node.hasOptions && node.options.length > 0) {
    h += 18 + node.options.length * 16;
  }
  return Math.max(PDF_NODE_MIN_HEIGHT, h);
}

function calcPdfLayout(nodes: AssistantNode[], nodeId: string, startX = 0, yOffset = 0): PdfLayout {
  const node = nodes.find(n => n.id === nodeId);
  const nodeHeight = node ? estimatePdfNodeHeight(node) : PDF_NODE_MIN_HEIGHT;
  if (!node) return { nodeId, x: startX, y: yOffset, width: PDF_NODE_WIDTH, height: nodeHeight, children: [] };

  const children = getChildNodes(nodes, nodeId);
  if (children.length === 0) {
    return { nodeId, x: startX, y: yOffset, width: PDF_NODE_WIDTH, height: nodeHeight, children: [] };
  }

  let currentX = startX;
  const childLayouts: PdfLayout[] = [];
  const childY = yOffset + nodeHeight + PDF_NODE_GAP_Y;
  for (const child of children) {
    const cl = calcPdfLayout(nodes, child.id, currentX, childY);
    childLayouts.push(cl);
    currentX += cl.width + PDF_NODE_GAP_X;
  }

  const totalChildrenWidth = currentX - startX - PDF_NODE_GAP_X;
  const width = Math.max(PDF_NODE_WIDTH, totalChildrenWidth);
  const x = startX + (totalChildrenWidth - PDF_NODE_WIDTH) / 2;

  return { nodeId, x: Math.max(startX, x), y: yOffset, width, height: nodeHeight, children: childLayouts };
}

function createNodeDiv(node: AssistantNode, layout: PdfLayout, parentNode?: AssistantNode): HTMLDivElement {
  const colors = NODE_COLORS[node.type] || NODE_COLORS.question;
  const inputMode = node.inputMode || 'keypress';
  const div = document.createElement('div');
  div.style.cssText = `
    position: absolute; left: ${layout.x}px; top: ${layout.y}px;
    width: ${PDF_NODE_WIDTH}px; min-height: ${layout.height}px;
    background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 12px;
    padding: 10px; box-sizing: border-box; font-family: Inter, system-ui, sans-serif;
    ${node.isImportant ? 'box-shadow: 0 0 0 2px #facc15, 0 0 0 4px #fef08a;' : ''}
  `;

  // Option badge
  const optionLabel = parentNode?.options.find(o => o.targetNodeId === node.id)?.label;
  const optionKey = parentNode?.options.find(o => o.targetNodeId === node.id)?.key;
  if (optionLabel) {
    const badge = document.createElement('div');
    badge.style.cssText = `position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
      background: #1a1a2e; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 8px;
      border-radius: 10px; white-space: nowrap;`;
    badge.textContent = (optionKey && inputMode !== 'ai_keyword' ? `[${optionKey}] ` : '') + optionLabel;
    div.appendChild(badge);
  }

  // Header
  const header = document.createElement('div');
  header.style.cssText = `font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${colors.text}; margin-bottom: 4px;`;
  header.textContent = getNodeTypeLabel(node.type);
  div.appendChild(header);

  // Title
  const title = document.createElement('div');
  title.style.cssText = `font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; line-height: 1.3;`;
  title.textContent = node.title;
  div.appendChild(title);

  // Ansage text
  if (node.ansageText) {
    const text = document.createElement('div');
    text.style.cssText = `font-size: 10px; color: #666; line-height: 1.4; margin-bottom: 4px; white-space: pre-wrap; word-break: break-word;`;
    text.textContent = `„${node.ansageText}"`;
    div.appendChild(text);
  }

  // Translations
  const localizedTexts = node.localizedAnsageTexts || {};
  const localizedTitles = node.localizedTitles || {};
  const langs = [...new Set([...Object.keys(localizedTexts), ...Object.keys(localizedTitles)])];
  if (langs.length > 0) {
    const transSection = document.createElement('div');
    transSection.style.cssText = `margin-top: 4px; padding-top: 4px; border-top: 1px solid ${colors.border}44;`;
    for (const lang of langs) {
      const langDiv = document.createElement('div');
      langDiv.style.cssText = `font-size: 9px; margin-bottom: 2px;`;
      const badge = document.createElement('span');
      badge.style.cssText = `display: inline-block; background: #e2e8f0; color: #475569; font-weight: 700; font-size: 8px; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; margin-right: 4px;`;
      badge.textContent = lang;
      langDiv.appendChild(badge);
      if (localizedTitles[lang]) {
        const t = document.createElement('span');
        t.style.cssText = `font-weight: 600; color: #1a1a2e;`;
        t.textContent = localizedTitles[lang];
        langDiv.appendChild(t);
      }
      if (localizedTexts[lang]) {
        const t = document.createElement('div');
        t.style.cssText = `color: #666; line-height: 1.3; margin-top: 2px; padding-left: 4px; white-space: pre-wrap; word-break: break-word;`;
        t.textContent = `„${localizedTexts[lang]}"`;
        langDiv.appendChild(t);
      }
      transSection.appendChild(langDiv);
    }
    div.appendChild(transSection);
  }

  // Tags
  const tagsDiv = document.createElement('div');
  tagsDiv.style.cssText = `display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;`;
  if (node.tag) {
    const tag = document.createElement('span');
    tag.style.cssText = `font-size: 9px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;`;
    tag.textContent = `Tag: ${node.tag}`;
    tagsDiv.appendChild(tag);
  }
  if (node.type === 'forward' && node.forwardNumber) {
    const fw = document.createElement('span');
    fw.style.cssText = `font-size: 9px; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px;`;
    fw.textContent = `→ ${node.forwardNumber}`;
    tagsDiv.appendChild(fw);
  }
  if (node.isImportant) {
    const imp = document.createElement('span');
    imp.style.cssText = `font-size: 9px; background: #fef9c3; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: 700;`;
    imp.textContent = `⚠ WICHTIG`;
    tagsDiv.appendChild(imp);
  }
  if (tagsDiv.children.length > 0) div.appendChild(tagsDiv);

  // Options
  if (node.hasOptions && node.options.length > 0) {
    const optSection = document.createElement('div');
    optSection.style.cssText = `margin-top: 6px; padding-top: 6px; border-top: 1px solid ${colors.border}44;`;
    const optHeader = document.createElement('div');
    optHeader.style.cssText = `font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;`;
    optHeader.textContent = `Optionen${inputMode !== 'keypress' ? ' (AI)' : ''}`;
    optSection.appendChild(optHeader);
    for (const opt of node.options) {
      const optRow = document.createElement('div');
      optRow.style.cssText = `display: flex; align-items: center; gap: 6px; font-size: 10px; color: #1a1a2e; margin-top: 2px;`;
      if (inputMode !== 'ai_keyword') {
        const keyBadge = document.createElement('span');
        keyBadge.style.cssText = `display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background: #e2e8f0; color: #475569; font-weight: 700; font-size: 9px; border-radius: 4px; flex-shrink: 0;`;
        keyBadge.textContent = opt.key;
        optRow.appendChild(keyBadge);
      }
      const label = document.createElement('span');
      label.textContent = opt.label;
      optRow.appendChild(label);
      if (opt.aiKeywords && opt.aiKeywords.length > 0) {
        const kw = document.createElement('span');
        kw.style.cssText = `font-size: 8px; color: #94a3b8; margin-left: auto; flex-shrink: 0;`;
        kw.textContent = `🔑 ${opt.aiKeywords.slice(0, 2).join(', ')}`;
        optRow.appendChild(kw);
      }
      optSection.appendChild(optRow);
    }
    div.appendChild(optSection);
  }

  return div;
}

function buildPdfDom(nodes: AssistantNode[], layout: PdfLayout, container: HTMLDivElement, parentNode?: AssistantNode) {
  const node = nodes.find(n => n.id === layout.nodeId);
  if (!node) return;
  container.appendChild(createNodeDiv(node, layout, parentNode));

  // Connection lines (as absolutely positioned divs)
  for (const child of layout.children) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const parentCX = layout.x + PDF_NODE_WIDTH / 2;
    const parentBY = layout.y + layout.height;
    const childCX = child.x + PDF_NODE_WIDTH / 2;
    const childTY = child.y;
    const minX = Math.min(parentCX, childCX) - 5;
    const maxX = Math.max(parentCX, childCX) + 5;
    svg.setAttribute('style', `position: absolute; left: ${minX}px; top: ${parentBY}px; overflow: visible; pointer-events: none;`);
    svg.setAttribute('width', `${maxX - minX + 10}`);
    svg.setAttribute('height', `${childTY - parentBY + 10}`);
    const midY = (childTY - parentBY) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${parentCX - minX} 0 C ${parentCX - minX} ${midY}, ${childCX - minX} ${midY}, ${childCX - minX} ${childTY - parentBY}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#cbd5e1');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);
    container.appendChild(svg);

    buildPdfDom(nodes, child, container, node);
  }
}

function getBounds(layout: PdfLayout): { maxX: number; maxY: number } {
  let maxX = layout.x + PDF_NODE_WIDTH;
  let maxY = layout.y + layout.height;
  for (const child of layout.children) {
    const cb = getBounds(child);
    maxX = Math.max(maxX, cb.maxX);
    maxY = Math.max(maxY, cb.maxY);
  }
  return { maxX, maxY };
}

export async function downloadPDF(config: AssistantConfig) {
  const root = getRootNode(config.nodes);
  if (!root) return;

  const layout = calcPdfLayout(config.nodes, root.id, 50, 50);
  const bounds = getBounds(layout);

  // Create off-screen container with inline styles
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; z-index: -1;
    width: ${bounds.maxX + 60}px; height: ${bounds.maxY + 40}px;
    background: #ffffff; overflow: visible; font-family: Inter, system-ui, sans-serif;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `position: absolute; left: 14px; top: 10px;`;
  const h1 = document.createElement('div');
  h1.style.cssText = `font-size: 18px; font-weight: 700; color: #1a1a2e;`;
  h1.textContent = `Telefonassistent: ${config.praxisName}`;
  const date = document.createElement('div');
  date.style.cssText = `font-size: 11px; color: #94a3b8;`;
  date.textContent = `Stand: ${new Date(config.updatedAt).toLocaleDateString('de-DE')}`;
  header.appendChild(h1);
  header.appendChild(date);
  container.appendChild(header);

  buildPdfDom(config.nodes, layout, container);

  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 100));
    // Move to visible position briefly for html2canvas (it needs visible elements)
    container.style.left = '0px';
    container.style.zIndex = '99999';
    container.style.opacity = '0';
    await new Promise(r => setTimeout(r, 200));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfW = (canvas.width / 2) * 0.264583;
    const pdfH = (canvas.height / 2) * 0.264583;

    const doc = new jsPDF({
      orientation: pdfW > pdfH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [Math.max(pdfW, 210), Math.max(pdfH, 297)],
    });

    doc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    doc.save(`TA_${config.praxisName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
  } finally {
    document.body.removeChild(container);
  }
}
