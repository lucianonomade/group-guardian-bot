import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";

interface GroupRulesDialogProps {
  groupId: string | null;
  groupName: string;
  currentRules: string | null;
  onClose: () => void;
  onSaved: (groupId: string, rules: string | null) => void;
}

export function GroupRulesDialog({ groupId, groupName, currentRules, onClose, onSaved }: GroupRulesDialogProps) {
  const [rules, setRules] = useState(currentRules || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRules(currentRules || "");
  }, [currentRules, groupId]);

  const handleSave = async () => {
    if (!groupId) return;
    setSaving(true);
    const value = rules.trim() || null;
    const { error } = await supabase
      .from("groups")
      .update({ rules_text: value } as any)
      .eq("id", groupId);
    if (error) {
      toast.error("Erro ao salvar regras");
    } else {
      toast.success(value ? "Regras salvas!" : "Regras removidas!");
      onSaved(groupId, value);
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!groupId} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Regras do Grupo
          </DialogTitle>
          <DialogDescription>{groupName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={rules}
            onChange={e => setRules(e.target.value)}
            placeholder="Digite as regras do grupo aqui...&#10;&#10;Exemplo:&#10;1. Não enviar links&#10;2. Respeitar todos os membros&#10;3. Não fazer spam"
            className="min-h-[180px] bg-muted/30 border-border/50 text-sm"
            maxLength={2000}
          />
          <p className="text-[10px] text-muted-foreground/50 text-right">{rules.length}/2000</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
