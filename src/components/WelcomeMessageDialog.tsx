import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Save, Plus, Trash2, BookmarkCheck } from "lucide-react";

interface WelcomeMessageDialogProps {
  group: { id: string; name: string; welcome_message: string | null } | null;
  onClose: () => void;
  onSaved: (groupId: string, message: string | null) => void;
}

interface CustomTemplate {
  id: string;
  name: string;
  content: string;
}

const BUILT_IN_TEMPLATES = [
  { label: "👋 Simples", text: "Olá {{nome}}, bem-vindo(a) ao grupo! 👋" },
  { label: "📜 Com regras", text: "Olá {{nome}}, seja bem-vindo(a)! 👋\n\n📜 Por favor, leia as regras fixadas antes de interagir.\n\nBoa convivência a todos!" },
  { label: "🎉 Festivo", text: "🎉 *{{nome}}* chegou!\n\nSeja muito bem-vindo(a) ao nosso grupo! Fique à vontade para se apresentar e participar das conversas. 💬" },
  { label: "🏢 Profissional", text: "Bem-vindo(a), {{nome}}! 👋\n\nEste grupo é destinado a discussões profissionais. Por favor:\n\n✅ Apresente-se brevemente\n✅ Mantenha o foco nos temas do grupo\n✅ Respeite todos os membros\n\nBom trabalho!" },
];

export function WelcomeMessageDialog({ group, onClose, onSaved }: WelcomeMessageDialogProps) {
  const { user } = useAuth();
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [newTplName, setNewTplName] = useState("");
  const [showSaveTpl, setShowSaveTpl] = useState(false);

  useEffect(() => {
    if (group) {
      setWelcomeMsg(group.welcome_message || "");
      setShowSaveTpl(false);
      setNewTplName("");
    }
  }, [group]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("welcome_templates")
      .select("*")
      .order("created_at")
      .then(({ data }) => setCustomTemplates((data as CustomTemplate[]) ?? []));
  }, [user]);

  const saveMessage = async () => {
    if (!group) return;
    setSaving(true);
    const message = welcomeMsg.trim() || null;
    await supabase.from("groups").update({ welcome_message: message } as any).eq("id", group.id);
    onSaved(group.id, message);
    toast.success(message ? "Mensagem de boas-vindas salva!" : "Mensagem de boas-vindas removida!");
    onClose();
    setSaving(false);
  };

  const saveAsTemplate = async () => {
    const name = newTplName.trim();
    if (!name || !welcomeMsg.trim() || !user) return;
    const { data, error } = await supabase
      .from("welcome_templates")
      .insert({ user_id: user.id, name, content: welcomeMsg.trim() } as any)
      .select()
      .single();
    if (error) {
      toast.error("Erro ao salvar template");
      return;
    }
    setCustomTemplates(prev => [...prev, data as CustomTemplate]);
    setShowSaveTpl(false);
    setNewTplName("");
    toast.success("Template salvo!");
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("welcome_templates").delete().eq("id", id);
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template removido");
  };

  // WhatsApp-style preview
  const previewText = welcomeMsg
    ? welcomeMsg.replace(/\{\{nome\}\}/gi, "João")
    : "";

  // Render WhatsApp bold (*text*) as <strong>
  const renderWhatsAppText = (text: string) => {
    return text.split("\n").map((line, i) => (
      <span key={i}>
        {i > 0 && <br />}
        {line.split(/(\*[^*]+\*)/).map((part, j) =>
          part.startsWith("*") && part.endsWith("*") ? (
            <strong key={j}>{part.slice(1, -1)}</strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </span>
    ));
  };

  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass-card border-border/50 sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Mensagem de boas-vindas
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 pb-2">
            <p className="text-xs text-muted-foreground">
              Grupo: <span className="font-medium text-foreground">{group?.name}</span>
            </p>

            {/* Built-in templates */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70">Templates prontos</Label>
              <div className="grid grid-cols-2 gap-2">
                {BUILT_IN_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setWelcomeMsg(tpl.text)}
                    className="text-[11px] h-auto py-2 px-3 border-border/40 hover:border-primary/40 hover:bg-primary/5 justify-start text-left"
                  >
                    {tpl.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom templates */}
            {customTemplates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70">Seus templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {customTemplates.map((tpl) => (
                    <div key={tpl.id} className="group relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWelcomeMsg(tpl.content)}
                        className="text-[11px] h-auto py-2 px-3 pr-8 border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 justify-start text-left w-full"
                      >
                        <BookmarkCheck className="h-3 w-3 mr-1.5 text-primary shrink-0" />
                        {tpl.name}
                      </Button>
                      <button
                        onClick={() => deleteTemplate(tpl.id)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Mensagem (use <code className="bg-muted px-1 rounded text-[10px]">{"{{nome}}"}</code> para o nome)
                </Label>
                {welcomeMsg.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSaveTpl(!showSaveTpl)}
                    className="text-[10px] h-6 px-2 text-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Salvar como template
                  </Button>
                )}
              </div>

              {showSaveTpl && (
                <div className="flex gap-2">
                  <Input
                    value={newTplName}
                    onChange={e => setNewTplName(e.target.value)}
                    placeholder="Nome do template..."
                    className="text-xs h-8 bg-muted/30 border-border/50"
                    maxLength={50}
                    onKeyDown={e => e.key === "Enter" && saveAsTemplate()}
                  />
                  <Button size="sm" onClick={saveAsTemplate} className="text-xs h-8 px-3" disabled={!newTplName.trim()}>
                    Salvar
                  </Button>
                </div>
              )}

              <Textarea
                value={welcomeMsg}
                onChange={e => setWelcomeMsg(e.target.value)}
                placeholder={"Olá {{nome}}, bem-vindo(a) ao grupo! 👋\n\nPor favor, leia as regras fixadas."}
                className="bg-muted/30 border-border/50 min-h-[100px] text-sm"
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground/50 text-right">{welcomeMsg.length}/1000</p>
            </div>

            {/* WhatsApp Preview */}
            {previewText && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground/70">Pré-visualização</Label>
                <div className="rounded-xl bg-[#0b141a] p-4 space-y-2">
                  {/* Chat header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <div className="h-6 w-6 rounded-full bg-emerald-700/50 flex items-center justify-center">
                      <span className="text-[9px] text-white/70">G</span>
                    </div>
                    <span className="text-[11px] text-white/80 font-medium">{group?.name}</span>
                  </div>
                  {/* Message bubble */}
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] shadow-sm">
                      <p className="text-[12px] text-white/90 leading-relaxed whitespace-pre-wrap">
                        {renderWhatsAppText(previewText)}
                      </p>
                      <p className="text-[9px] text-white/40 text-right mt-1">12:00 ✓✓</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              {group?.welcome_message && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWelcomeMsg("")}
                  className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  Remover
                </Button>
              )}
              <Button
                size="sm"
                onClick={saveMessage}
                disabled={saving}
                className="text-xs bg-gradient-to-r from-primary to-emerald-500"
              >
                <Save className="mr-1.5 h-3 w-3" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}