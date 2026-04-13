import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, Copy, Loader2, ArrowLeft, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function CheckoutPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ pix_code?: string; pix_qrcode?: string } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [copied, setCopied] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const handleCreatePix = async () => {
    if (!customerName.trim() || !customerDocument.trim() || !customerPhone.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      // First, get or create the offer
      const { data: setupData, error: setupError } = await supabase.functions.invoke("pepper-checkout", {
        body: { action: "setup" },
      });

      if (setupError) throw setupError;

      // Get offer hash from setup response
      let offerHash = setupData?.offer_hash || 
        setupData?.data?.offer_hash ||
        setupData?.data?.data?.offers?.[0]?.hash ||
        setupData?.data?.offers?.[0]?.hash || "";

      if (!offerHash) {
        // Try listing products to find existing offer
        const { data: listData } = await supabase.functions.invoke("pepper-checkout", {
          body: { action: "list_products" },
        });
        
        const products = listData?.data?.data || listData?.data || [];
        if (Array.isArray(products) && products.length > 0) {
          offerHash = products[0]?.offers?.[0]?.hash || "";
        }
      }

      if (!offerHash) {
        toast.error("Erro ao configurar produto. Tente novamente.");
        setLoading(false);
        return;
      }

      // Create PIX transaction
      const { data: txData, error: txError } = await supabase.functions.invoke("pepper-checkout", {
        body: {
          action: "create_pix",
          offer_hash: offerHash,
          customer_name: customerName,
          customer_email: user.email,
          customer_document: customerDocument.replace(/\D/g, ""),
          customer_phone: customerPhone.replace(/\D/g, ""),
        },
      });

      if (txError) throw txError;

      if (txData?.success && txData?.data) {
        setPixData({
          pix_code: txData.data.pix_code || txData.data.pix?.code || "",
          pix_qrcode: txData.data.pix_qrcode || txData.data.pix?.qrcode || "",
        });
        toast.success("PIX gerado com sucesso!");
      } else {
        toast.error("Erro ao gerar PIX. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.pix_code) {
      navigator.clipboard.writeText(pixData.pix_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute left-1/2 top-0 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.05] blur-[200px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-16 py-5 border-b border-border/20">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-teal-400 to-cyan-400 shadow-lg shadow-primary/25">
            <Shield className="h-5 w-5 text-background" />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            WhatsGuard
          </span>
        </Link>
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {!pixData ? (
            <Card className="rounded-2xl border-primary/20 shadow-2xl shadow-primary/10 bg-card/80">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
              <CardHeader className="pb-4 pt-7 px-7">
                <Badge className="w-fit mb-3 rounded-full bg-primary/15 text-primary border-primary/20 text-[10px] font-bold">
                  <Shield className="mr-1 h-3 w-3" /> WhatsGuard Pro
                </Badge>
                <CardTitle className="text-xl font-bold">Assinar WhatsGuard Pro</CardTitle>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xs text-muted-foreground/40">R$</span>
                  <span className="text-4xl font-extrabold tracking-tight gradient-text">100</span>
                  <span className="text-sm text-muted-foreground/40">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground/50 mt-2">Pagamento via PIX • Acesso imediato</p>
              </CardHeader>
              <CardContent className="px-7 pb-7 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Nome completo</Label>
                  <Input
                    placeholder="Seu nome"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={customerDocument}
                    onChange={(e) => setCustomerDocument(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <ul className="space-y-2 py-3 border-t border-border/20">
                  {["Instâncias ilimitadas", "Moderação 24/7", "Todos os recursos", "Suporte prioritário"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground/70">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={handleCreatePix}
                  disabled={loading}
                  className="w-full rounded-xl h-12 font-bold bg-gradient-to-r from-primary via-teal-500 to-cyan-500 text-background shadow-lg shadow-primary/25 hover:opacity-90"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX...</>
                  ) : (
                    <><QrCode className="mr-2 h-4 w-4" /> Gerar PIX</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-primary/20 shadow-2xl shadow-primary/10 bg-card/80">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
              <CardHeader className="pb-4 pt-7 px-7 text-center">
                <QrCode className="h-10 w-10 text-primary mx-auto mb-3" />
                <CardTitle className="text-xl font-bold">Pague com PIX</CardTitle>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Escaneie o QR Code ou copie o código
                </p>
              </CardHeader>
              <CardContent className="px-7 pb-7 space-y-5">
                {pixData.pix_qrcode && (
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      <img
                        src={pixData.pix_qrcode}
                        alt="QR Code PIX"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                )}

                {pixData.pix_code && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Código PIX (Copia e Cola)</Label>
                    <div className="relative">
                      <Input
                        readOnly
                        value={pixData.pix_code}
                        className="rounded-xl pr-12 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyPixCode}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      >
                        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
                  <p className="text-xs text-muted-foreground/70">
                    Após o pagamento, seu acesso será liberado automaticamente.
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    Valor: R$ 100,00
                  </p>
                </div>

                <Link to="/dashboard">
                  <Button variant="outline" className="w-full rounded-xl h-11 font-semibold">
                    Já paguei, ir para o Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
