import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const PEPPER_API_URL = "https://api.cloud.pepperpay.com.br/public/v1";

function pepperHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const pepperToken = Deno.env.get("PEPPER_API_TOKEN")!;
    const headers = pepperHeaders(pepperToken);

    // ── LIST PRODUCTS ──
    if (action === "list_products") {
      const res = await fetch(`${PEPPER_API_URL}/products`, { headers });
      const data = await res.json();
      console.log("List products response:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SETUP (create product if none exists) ──
    if (action === "setup") {
      // First check if product already exists
      const listRes = await fetch(`${PEPPER_API_URL}/products`, { headers });
      const listData = await listRes.json();
      console.log("Existing products:", JSON.stringify(listData));

      const products = listData?.data || listData || [];
      if (Array.isArray(products) && products.length > 0) {
        const offerHash = products[0]?.offers?.[0]?.hash;
        if (offerHash) {
          return new Response(JSON.stringify({ success: true, offer_hash: offerHash }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Create new product
      const productRes = await fetch(`${PEPPER_API_URL}/products`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: "WhatsGuard Pro",
          description: "Plano mensal completo do WhatsGuard - Moderação automática para WhatsApp",
          category: "software",
          product_type: "subscription",
          sale_page: "https://guardian-group-bot.lovable.app",
          price: 10000,
        }),
      });

      const productData = await productRes.json();
      console.log("Create product response:", JSON.stringify(productData));

      const offerHash = productData?.data?.offers?.[0]?.hash;
      return new Response(JSON.stringify({ success: true, offer_hash: offerHash, raw: productData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE PIX ──
    if (action === "create_pix") {
      const { offer_hash, customer_name, customer_email, customer_document, customer_phone } = body;

      if (!offer_hash) {
        return new Response(JSON.stringify({ error: "offer_hash é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const txRes = await fetch(`${PEPPER_API_URL}/transactions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          api_token: pepperToken,
          amount: 10000,
          payment_method: "pix",
          installments: 1,
          cart: [{
            offer_hash,
            price: 10000,
            quantity: 1,
            operation_type: 1,
            title: "WhatsGuard Pro - Plano Mensal",
          }],
          customer: {
            name: customer_name || "Cliente",
            email: customer_email || user.email,
            document: customer_document || "",
            phone_number: customer_phone || "11999999999",
          },
        }),
      });

      const txData = await txRes.json();
      console.log("PIX transaction response:", JSON.stringify(txData));

      // Pepper returns transaction data directly or wrapped in .data
      const tx = txData.data || txData;
      const hasTransaction = tx.transaction || tx.hash || tx.event === "transaction";

      if (hasTransaction) {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const pixCode = tx.pix?.pix_qr_code || tx.pix_code || "";
        const pixQrcode = tx.pix?.qr_code_base64
          ? `data:image/png;base64,${tx.pix.qr_code_base64}`
          : "";

        await serviceClient.from("subscriptions").insert({
          user_id: user.id,
          status: "pending",
          pepper_transaction_id: tx.transaction || tx.hash || "",
          pix_code: pixCode,
          pix_qrcode: pixQrcode,
          amount: 10000,
        });

        return new Response(JSON.stringify({
          success: true,
          data: {
            pix_code: pixCode,
            pix_qrcode: pixQrcode,
            transaction_id: tx.transaction || tx.hash,
            payment_status: tx.payment_status,
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: txData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pepper-checkout error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
