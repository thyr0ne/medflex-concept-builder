import { AssistantNode, NodeType, AnswerFormat, KeyOption } from '@/types/assistant';
import { getNodeTypeLabel } from '@/lib/assistant-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface NodeEditorProps {
  node: AssistantNode;
  allNodes: AssistantNode[];
  onUpdate: (node: AssistantNode) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
}

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'greeting', label: 'Begrüßung' },
  { value: 'question', label: 'Frage' },
  { value: 'action', label: 'Aktion' },
  { value: 'end', label: 'Schluss' },
  { value: 'forward', label: 'Weiterleitung' },
];

export default function NodeEditor({ node, allNodes, onUpdate, onDelete, onAddChild }: NodeEditorProps) {
  const isRoot = !node.parentId;
  const children = allNodes.filter(n => n.parentId === node.id);

  const update = (partial: Partial<AssistantNode>) => {
    onUpdate({ ...node, ...partial });
  };

  const addOption = () => {
    const newChild = onAddChild(node.id);
    // We don't create the option link here since addChild is external
  };

  const updateOption = (index: number, partial: Partial<KeyOption>) => {
    const newOptions = [...node.options];
    newOptions[index] = { ...newOptions[index], ...partial };
    update({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const option = node.options[index];
    const newOptions = node.options.filter((_, i) => i !== index);
    update({ options: newOptions });
  };

  const addOptionEntry = () => {
    const nextKey = String(node.options.length + 1);
    // Create a child node for this option
    const newOptions: KeyOption[] = [...node.options, { key: nextKey, label: '', targetNodeId: '' }];
    update({ options: newOptions, hasOptions: true });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{node.title}</h2>
        {!isRoot && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(node.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1" /> Löschen
          </Button>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label>Titel</Label>
        <Input value={node.title} onChange={e => update({ title: e.target.value })} placeholder="z.B. Begrüßung, Terminauswahl..." />
      </div>

      {/* Node Type */}
      <div className="space-y-1.5">
        <Label>Typ</Label>
        <Select value={node.type} onValueChange={(v: NodeType) => update({ type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {NODE_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Format */}
      <div className="space-y-1.5">
        <Label>Format</Label>
        <Select value={node.format} onValueChange={(v: AnswerFormat) => update({ format: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="synthetic">Synthetisch (Text)</SelectItem>
            <SelectItem value="audiofile">Audiofile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audio file name */}
      {node.format === 'audiofile' && (
        <div className="space-y-1.5">
          <Label>Audiofile Name</Label>
          <Input value={node.audioFileName || ''} onChange={e => update({ audioFileName: e.target.value })} placeholder="Name des Audiofiles" />
        </div>
      )}

      {/* Ansage Text */}
      <div className="space-y-1.5">
        <Label>Ansagetext</Label>
        <Textarea
          value={node.ansageText}
          onChange={e => update({ ansageText: e.target.value })}
          placeholder="Der Text der Ansage..."
          rows={4}
        />
      </div>

      {/* Tag */}
      <div className="space-y-1.5">
        <Label>Tag / Kanal</Label>
        <Input value={node.tag || ''} onChange={e => update({ tag: e.target.value || undefined })} placeholder="z.B. Termin, Rezept, Akut..." />
      </div>

      {/* Forward */}
      {node.type === 'forward' && (
        <>
          <div className="space-y-1.5">
            <Label>Weiterleitung an Telefonnummer</Label>
            <Input value={node.forwardNumber || ''} onChange={e => update({ forwardNumber: e.target.value })} placeholder="+49..." />
          </div>
          <div className="space-y-1.5">
            <Label>Fallback-Text (wenn nicht erreichbar)</Label>
            <Textarea
              value={node.forwardFallbackText || ''}
              onChange={e => update({ forwardFallbackText: e.target.value })}
              rows={3}
              placeholder="Text wenn niemand abnimmt..."
            />
          </div>
        </>
      )}

      {/* Options */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Tastendruck-Optionen</Label>
          <Switch checked={node.hasOptions} onCheckedChange={v => update({ hasOptions: v })} />
        </div>

        {node.hasOptions && (
          <div className="space-y-2">
            {node.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded w-8 text-center shrink-0">{opt.key}</span>
                <Input
                  value={opt.label}
                  onChange={e => updateOption(i, { label: e.target.value })}
                  placeholder="Bezeichnung"
                  className="flex-1"
                />
                <Select
                  value={opt.targetNodeId || '_none'}
                  onValueChange={v => updateOption(i, { targetNodeId: v === '_none' ? '' : v })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Zielknoten" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Kein Ziel —</SelectItem>
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeOption(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOptionEntry} className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1" /> Option hinzufügen
            </Button>
          </div>
        )}
      </div>

      {/* Children info */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Kind-Knoten ({children.length})</Label>
          <Button variant="outline" size="sm" onClick={() => onAddChild(node.id)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Hinzufügen
          </Button>
        </div>
        {children.length > 0 && (
          <div className="space-y-1">
            {children.map(c => (
              <div key={c.id} className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                {getNodeTypeLabel(c.type)}: {c.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
