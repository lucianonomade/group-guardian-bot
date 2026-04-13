import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const languages = [
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export function LanguageSelector() {
  const [currentLang, setCurrentLang] = useState("pt-BR");
  const [open, setOpen] = useState(false);

  const handleSelect = (code: string) => {
    setCurrentLang(code);
    setOpen(false);
    const lang = languages.find(l => l.code === code);
    toast.success(`Idioma alterado para ${lang?.label}`, {
      icon: <span className="text-base">{lang?.flag}</span>,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground/50 hover:text-foreground">
          <Globe className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1.5 glass-card border-border/50" align="end" sideOffset={8}>
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Idioma</p>
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/20 transition-colors"
          >
            <span className="text-base">{lang.flag}</span>
            <span className={`flex-1 text-left ${currentLang === lang.code ? "text-foreground font-medium" : "text-muted-foreground/70"}`}>
              {lang.label}
            </span>
            {currentLang === lang.code && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
