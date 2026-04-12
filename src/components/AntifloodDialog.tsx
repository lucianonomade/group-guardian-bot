import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface AntifloodDialogProps {
  groupId: string | null;
  groupName: string;
  onClose: () => void;
}

export function AntifloodDialog({ groupId, groupName, onClose }: AntifloodDialogProps) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(true);
  const [maxMessages, setMaxMessages] = useState(5);
  const [timeWindow, setTimeWindow] = useState(10);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    loadSettings();
  }, [groupId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("antiflood_settings")
      .select("*")
      .eq("group_id", groupId!)
      .maybeSingle();

    if (data) {
      setIsEnabled(data.is_enabled);
      setMaxMessages(data.max_messages);
      setTimeWindow(data.time_window_seconds);
      setExistingId(data.id);
    } else {
      setIsEnabled(true);
      setMaxMessages(5);
      setTimeWindow(10);
      setExistingId(null);
    }
  };

  const handleSave = async () => {
    if (!groupId || !user) return;
    setLoading(true);

    const payload = {
      group_id: groupId,
      user_id: user.id,
      is_enabled: isEnabled,
      max_messages: maxMessages,
      time_window_seconds: timeWindow,
    };

    if (existingId) {
      await supabase.from("antiflood_settings").update(payload).eq("id", existingId);
    } else {
      await supabase.from("antiflood_settings").insert(payload);
    }

    toast.success("Configuração anti-flood salva!");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={!!groupId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anti-Flood</DialogTitle>
          <DialogDescription>
            Configure o limite de mensagens para {groupName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="flood-enabled">Ativado</Label>
            <Switch id="flood-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-msgs">Máximo de mensagens</Label>
            <Input
              id="max-msgs"
              type="number"
              min={2}
              max={50}
              value={maxMessages}
              onChange={(e) => setMaxMessages(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Quantidade máxima de mensagens permitidas na janela de tempo</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time-window">Janela de tempo (segundos)</Label>
            <Input
              id="time-window"
              type="number"
              min={5}
              max={120}
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Período em segundos para contagem de mensagens</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
