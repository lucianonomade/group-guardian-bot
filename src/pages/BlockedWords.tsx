import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquareOff, Download, Upload } from "lucide-react";

interface BlockedWord {
  id: string;
  word: string;
  category: string;
  is_active: boolean;
}

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "palavrao", label: "Palavrão" },
  { value: "pornografia", label: "Pornografia" },
  { value: "spam", label: "Spam" },
  { value: "ofensa", label: "Ofensa" },
];

export default function BlockedWords() {
  const { user } = useAuth();
  const [words, setWords] = useState<BlockedWord[]>([]);
  const [newWord, setNewWord] = useState("");
  const [newCategory, setNewCategory] = useState("geral");
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");

  const fetchWords = async () => {
    const { data } = await supabase.from("blocked_words").select("*").order("word");
    setWords((data as BlockedWord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchWords();
  }, [user]);

  const addWord = async () => {
    if (!newWord.trim()) return;
    const { error } = await supabase.from("blocked_words").insert({
      user_id: user!.id,
      word: newWord.trim().toLowerCase(),
      category: newCategory,
    });
    if (error) {
      toast.error("Erro ao adicionar palavra");
    } else {
      toast.success("Palavra adicionada!");
      setNewWord("");
      fetchWords();
    }
  };

  const toggleWord = async (w: BlockedWord) => {
    await supabase.from("blocked_words").update({ is_active: !w.is_active }).eq("id", w.id);
    setWords(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
  };

  const deleteWord = async (id: string) => {
    await supabase.from("blocked_words").delete().eq("id", id);
    setWords(prev => prev.filter(w => w.id !== id));
    toast.success("Palavra removida!");
  };

  const exportWords = () => {
    const data = JSON.stringify(words.map(w => ({ word: w.word, category: w.category })), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palavras_bloqueadas.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWords = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text) as { word: string; category: string }[];
      const inserts = data.map(d => ({
        user_id: user!.id,
        word: d.word.toLowerCase(),
        category: d.category || "geral",
      }));
      await supabase.from("blocked_words").insert(inserts);
      toast.success(`${data.length} palavras importadas!`);
      fetchWords();
    } catch {
      toast.error("Arquivo JSON inválido");
    }
  };

  const filtered = filterCategory === "all" ? words : words.filter(w => w.category === filterCategory);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Palavras Bloqueadas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configure palavras que o bot vai monitorar</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportWords} className="border-border/50 text-xs">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
            </Button>
            <Button variant="outline" size="sm" asChild className="border-border/50 text-xs">
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Importar
                <input type="file" accept=".json" className="hidden" onChange={importWords} />
              </label>
            </Button>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Adicionar Palavra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="Digite a palavra..." onKeyDown={e => e.key === "Enter" && addWord()} className="bg-muted/30 border-border/50" />
              </div>
              <div className="w-[180px]">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addWord} className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/20">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={filterCategory === "all" ? "default" : "outline"} 
            className={`cursor-pointer text-xs ${filterCategory === "all" ? "bg-primary/15 text-primary border-primary/20" : "border-border/50 text-muted-foreground"}`} 
            onClick={() => setFilterCategory("all")}
          >
            Todas ({words.length})
          </Badge>
          {CATEGORIES.map(c => {
            const count = words.filter(w => w.category === c.value).length;
            return (
              <Badge 
                key={c.value} 
                variant={filterCategory === c.value ? "default" : "outline"} 
                className={`cursor-pointer text-xs ${filterCategory === c.value ? "bg-primary/15 text-primary border-primary/20" : "border-border/50 text-muted-foreground"}`} 
                onClick={() => setFilterCategory(c.value)}
              >
                {c.label} ({count})
              </Badge>
            );
          })}
        </div>

        <Card className="glass-card">
          <CardContent className="p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <MessageSquareOff className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma palavra bloqueada.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filtered.map(w => (
                  <div key={w.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 transition-colors hover:border-border/50">
                    <Switch checked={w.is_active} onCheckedChange={() => toggleWord(w)} className="scale-75" />
                    <span className={`text-sm font-medium ${!w.is_active ? "line-through text-muted-foreground/40" : ""}`}>{w.word}</span>
                    <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground/60">{w.category}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-destructive" onClick={() => deleteWord(w.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
