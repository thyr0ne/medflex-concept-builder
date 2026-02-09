import { useAssistantConfig } from '@/hooks/useAssistantConfig';
import FlowchartView from '@/components/FlowchartView';
import NodeEditor from '@/components/NodeEditor';
import { downloadPDF, downloadText, downloadJSON } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, RotateCcw, Phone, PanelRightClose, PanelRight, Upload, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

const Index = () => {
  const {
    config,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    updatePraxisName,
    updateNode,
    addChildNode,
    insertNodeBeforeId,
    deleteNode,
    resetConfig,
    importConfig,
    exportConfigJSON,
  } = useAssistantConfig();

  const [editorOpen, setEditorOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await downloadPDF(config);
      toast.success('PDF wurde exportiert');
    } catch {
      toast.error('PDF Export fehlgeschlagen');
    }
    setIsExporting(false);
  };

  const handleExportText = () => {
    downloadText(config);
    toast.success('Textdatei wurde exportiert');
  };

  const handleExportJSON = () => {
    downloadJSON(config);
    toast.success('JSON wurde exportiert');
  };

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (importConfig(text)) {
        toast.success('Konfiguration importiert');
      } else {
        toast.error('Import fehlgeschlagen – ungültiges Format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (window.confirm('Möchten Sie die gesamte Konfiguration zurücksetzen?')) {
      resetConfig();
      toast.success('Konfiguration zurückgesetzt');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileImport}
      />

      {/* Top Bar */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Phone className="w-5 h-5" />
            <span className="font-semibold text-lg">TA Konfigurator</span>
          </div>
          <span className="text-muted-foreground">|</span>
          <Input
            value={config.praxisName}
            onChange={e => updatePraxisName(e.target.value)}
            className="w-64 h-8 text-sm font-medium border-none bg-transparent focus-visible:bg-muted"
            placeholder="Praxisname eingeben..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImportJSON} title="JSON importieren">
            <Upload className="w-4 h-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON} title="JSON exportieren">
            <FileJson className="w-4 h-4 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportText}>
            <FileText className="w-4 h-4 mr-1" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
            <Download className="w-4 h-4 mr-1" /> {isExporting ? 'Exportiere...' : 'PDF'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={() => setEditorOpen(!editorOpen)}>
            {editorOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <FlowchartView
            nodes={config.nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onAddChild={addChildNode}
            onInsertBefore={insertNodeBeforeId}
          />
        </main>

        <aside
          className={cn(
            'border-l bg-card overflow-y-auto transition-all duration-300 shrink-0',
            editorOpen ? 'w-96' : 'w-0 border-l-0'
          )}
        >
          {editorOpen && (
            <div className="p-5">
              {selectedNode ? (
                <NodeEditor
                  node={selectedNode}
                  allNodes={config.nodes}
                  onUpdate={updateNode}
                  onDelete={deleteNode}
                  onAddChild={addChildNode}
                  onInsertBefore={insertNodeBeforeId}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
                  <p className="text-sm">Wählen Sie einen Knoten im Diagramm aus, um ihn zu bearbeiten</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Legend */}
      <footer className="border-t bg-card px-4 py-2 flex items-center gap-6 text-xs shrink-0">
        <span className="text-muted-foreground font-medium">Legende:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-legend-greeting" />
          <span>Begrüßung</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-legend-question" />
          <span>Frage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-legend-action" />
          <span>Aktion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-legend-forward" />
          <span>Weiterleitung</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-legend-end" />
          <span>Schluss</span>
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-3 h-3 rounded ring-2 ring-yellow-400 bg-background" />
          <span>Wichtig</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
