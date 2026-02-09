import { useAssistantConfig } from '@/hooks/useAssistantConfig';
import TreeView from '@/components/TreeView';
import NodeEditor from '@/components/NodeEditor';
import { downloadPDF, downloadText } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, RotateCcw, Phone } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const {
    config,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    updatePraxisName,
    updateNode,
    addChildNode,
    deleteNode,
    resetConfig,
  } = useAssistantConfig();

  const handleExportPDF = () => {
    downloadPDF(config);
    toast.success('PDF wurde exportiert');
  };

  const handleExportText = () => {
    downloadText(config);
    toast.success('Textdatei wurde exportiert');
  };

  const handleReset = () => {
    if (window.confirm('Möchten Sie die gesamte Konfiguration zurücksetzen?')) {
      resetConfig();
      toast.success('Konfiguration zurückgesetzt');
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
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
          <Button variant="outline" size="sm" onClick={handleExportText}>
            <FileText className="w-4 h-4 mr-1" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tree */}
        <aside className="w-72 border-r bg-card overflow-y-auto shrink-0">
          <div className="px-3 py-2 border-b">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ablaufstruktur</h3>
          </div>
          <TreeView
            nodes={config.nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onAddChild={addChildNode}
          />
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedNode ? (
            <div className="max-w-2xl">
              <NodeEditor
                node={selectedNode}
                allNodes={config.nodes}
                onUpdate={updateNode}
                onDelete={deleteNode}
                onAddChild={addChildNode}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Wählen Sie einen Knoten aus der Baumstruktur
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
