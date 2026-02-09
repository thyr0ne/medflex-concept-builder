import { AssistantNode, NodeType, AnswerFormat, KeyOption, InputMode, SUPPORTED_LANGUAGES, LanguageCode } from '@/types/assistant';
import { getNodeTypeLabel } from '@/lib/assistant-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, AlertTriangle, Globe, X } from 'lucide-react';
import { useState } from 'react';

interface NodeEditorProps {
  node: AssistantNode;
  allNodes: AssistantNode[];
  onUpdate: (node: AssistantNode) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onInsertBefore: (nodeId: string) => void;
}

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'greeting', label: 'Begrüßung' },
  { value: 'question', label: 'Frage' },
  { value: 'action', label: 'Aktion' },
  { value: 'end', label: 'Schluss' },
  { value: 'forward', label: 'Weiterleitung' },
];

const INPUT_MODES: { value: InputMode; label: string }[] = [
  { value: 'keypress', label: 'Tastendruck' },
  { value: 'ai_keyword', label: 'AI Schlagworte' },
  { value: 'both', label: 'Beides' },
];

export default function NodeEditor({ node, allNodes, onUpdate, onDelete, onAddChild, onInsertBefore }: NodeEditorProps) {
  const isRoot = !node.parentId;
  const children = allNodes.filter(n => n.parentId === node.id);
  const [newKeyword, setNewKeyword] = useState('');
  const [showTranslations, setShowTranslations] = useState(false);
  const [activeLangs, setActiveLangs] = useState<LanguageCode[]>(() => {
    const langs = new Set<LanguageCode>();
    if (node.localizedTitles) Object.keys(node.localizedTitles).forEach(l => langs.add(l as LanguageCode));
    if (node.localizedAnsageTexts) Object.keys(node.localizedAnsageTexts).forEach(l => langs.add(l as LanguageCode));
    return Array.from(langs);
  });

  const update = (partial: Partial<AssistantNode>) => {
    onUpdate({ ...node, ...partial });
  };

  const updateOption = (index: number, partial: Partial<KeyOption>) => {
    const newOptions = [...node.options];
    newOptions[index] = { ...newOptions[index], ...partial };
    update({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = node.options.filter((_, i) => i !== index);
    update({ options: newOptions });
  };

  const addOptionEntry = () => {
    const nextKey = String(node.options.length + 1);
    const newOptions: KeyOption[] = [...node.options, { key: nextKey, label: '', targetNodeId: '', aiKeywords: [] }];
    update({ options: newOptions, hasOptions: true });
  };

  const addKeywordToOption = (optionIndex: number) => {
    if (!newKeyword.trim()) return;
    const opt = node.options[optionIndex];
    const keywords = [...(opt.aiKeywords || []), newKeyword.trim()];
    updateOption(optionIndex, { aiKeywords: keywords });
    setNewKeyword('');
  };

  const removeKeywordFromOption = (optionIndex: number, kwIndex: number) => {
    const opt = node.options[optionIndex];
    const keywords = (opt.aiKeywords || []).filter((_, i) => i !== kwIndex);
    updateOption(optionIndex, { aiKeywords: keywords });
  };

  const addLanguage = (lang: LanguageCode) => {
    if (!activeLangs.includes(lang)) {
      setActiveLangs([...activeLangs, lang]);
    }
  };

  const removeLanguage = (lang: LanguageCode) => {
    setActiveLangs(activeLangs.filter(l => l !== lang));
    const newTitles = { ...(node.localizedTitles || {}) };
    const newTexts = { ...(node.localizedAnsageTexts || {}) };
    delete newTitles[lang];
    delete newTexts[lang];
    update({ localizedTitles: newTitles, localizedAnsageTexts: newTexts });
  };

  const updateLocalizedTitle = (lang: string, value: string) => {
    const newTitles = { ...(node.localizedTitles || {}), [lang]: value };
    update({ localizedTitles: newTitles });
  };

  const updateLocalizedText = (lang: string, value: string) => {
    const newTexts = { ...(node.localizedAnsageTexts || {}), [lang]: value };
    update({ localizedAnsageTexts: newTexts });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{node.title}</h2>
        <div className="flex gap-1">
          {!isRoot && (
            <>
              <Button variant="outline" size="sm" onClick={() => onInsertBefore(node.id)} title="Knoten davor einfügen">
                <Plus className="w-4 h-4 mr-1" /> Davor
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(node.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Important toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <Label className="text-sm font-medium">Als wichtig markieren</Label>
        </div>
        <Switch checked={node.isImportant || false} onCheckedChange={v => update({ isImportant: v })} />
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label>Titel (DE)</Label>
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

      {node.format === 'audiofile' && (
        <div className="space-y-1.5">
          <Label>Audiofile Name</Label>
          <Input value={node.audioFileName || ''} onChange={e => update({ audioFileName: e.target.value })} placeholder="Name des Audiofiles" />
        </div>
      )}

      {/* Ansage Text */}
      <div className="space-y-1.5">
        <Label>Ansagetext (DE)</Label>
        <Textarea
          value={node.ansageText}
          onChange={e => update({ ansageText: e.target.value })}
          placeholder="Der Text der Ansage..."
          rows={5}
        />
      </div>

      {/* Multilingual */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Mehrsprachigkeit</Label>
          </div>
          <Switch checked={showTranslations} onCheckedChange={setShowTranslations} />
        </div>

        {showTranslations && (
          <div className="space-y-3">
            {/* Language selector */}
            <Select onValueChange={(v: LanguageCode) => addLanguage(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sprache hinzufügen..." />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.filter(l => l.code !== 'de' && !activeLangs.includes(l.code)).map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeLangs.map(lang => {
              const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label || lang;
              return (
                <div key={lang} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{langLabel}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLanguage(lang)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <Input
                    value={node.localizedTitles?.[lang] || ''}
                    onChange={e => updateLocalizedTitle(lang, e.target.value)}
                    placeholder={`Titel (${langLabel})`}
                  />
                  <Textarea
                    value={node.localizedAnsageTexts?.[lang] || ''}
                    onChange={e => updateLocalizedText(lang, e.target.value)}
                    placeholder={`Ansagetext (${langLabel})`}
                    rows={3}
                  />
                </div>
              );
            })}
          </div>
        )}
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
            <Label>Zurückholen nach X Sek. Klingeln</Label>
            <Input
              type="number"
              min={0}
              value={node.forwardRetrieveAfterSec ?? ''}
              onChange={e => update({ forwardRetrieveAfterSec: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="z.B. 30"
            />
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
          <Label className="text-sm font-medium">Optionen / Auswahl</Label>
          <Switch checked={node.hasOptions} onCheckedChange={v => update({ hasOptions: v })} />
        </div>

        {node.hasOptions && (
          <div className="space-y-3">
            {/* Input Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs">Eingabemodus</Label>
              <Select value={node.inputMode || 'keypress'} onValueChange={(v: InputMode) => update({ inputMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INPUT_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {node.options.map((opt, i) => (
              <div key={i} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  {(node.inputMode !== 'ai_keyword') && (
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded w-8 text-center shrink-0">{opt.key}</span>
                  )}
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
                    <SelectTrigger className="w-[160px]">
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

                {/* AI Keywords */}
                {(node.inputMode === 'ai_keyword' || node.inputMode === 'both') && (
                  <div className="space-y-1.5 pl-1">
                    <Label className="text-xs text-muted-foreground">AI Schlagworte</Label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(opt.aiKeywords || []).map((kw, kwi) => (
                        <Badge key={kwi} variant="secondary" className="text-xs gap-1">
                          {kw}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => removeKeywordFromOption(i, kwi)} />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        value={newKeyword}
                        onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeywordToOption(i); } }}
                        placeholder="Schlagwort eingeben..."
                        className="flex-1 h-7 text-xs"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addKeywordToOption(i)}>+</Button>
                    </div>
                  </div>
                )}
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
