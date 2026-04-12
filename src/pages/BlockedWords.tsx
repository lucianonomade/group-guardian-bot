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
            <h1 className="text-3xl font-bold tracking-tight">Palavras Bloqueadas</h1>
            <p className="text-muted-foreground">Configure palavras que o bot vai monitorar</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportWords}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1 h-4 w-4" /> Importar
                <input type="file" accept=".json" className="hidden" onChange={importWords} />
              </label>
            </Button>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Adicionar Palavra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="word">Palavra</Label>
                <Input id="word" value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="Digite a palavra..." onKeyDown={e => e.key === "Enter" && addWord()} />
              </div>
              <div className="w-[180px]">
                <Label>Categoria</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={addWord}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Badge variant={filterCategory === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterCategory("all")}>Todas ({words.length})</Badge>
          {CATEGORIES.map(c => {
            const count = words.filter(w => w.category === c.value).length;
            return (
              <Badge key={c.value} variant={filterCategory === c.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterCategory(c.value)}>
                {c.label} ({count})
              </Badge>
            );
          })}
        </div>

        <Card className="glass-card">
          <CardContent className="p-4">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <MessageSquareOff className="h-8 w-8" />
                <p>Nenhuma palavra bloqueada.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filtered.map(w => (
                  <div key={w.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                    <Switch checked={w.is_active} onCheckedChange={() => toggleWord(w)} className="scale-75" />
                    <span className={`text-sm font-medium ${!w.is_active ? "line-through text-muted-foreground" : ""}`}>{w.word}</span>
                    <Badge variant="outline" className="text-xs">{w.category}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteWord(w.id)}>
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
