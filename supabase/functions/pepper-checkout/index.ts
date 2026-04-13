import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const PEPPER_API_URL = "https://api.cloud.pepperpay.com.br/public/v1";

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

    const { action } = await req.json();
    const pepperToken = Deno.env.get("PEPPER_API_TOKEN")!;

    if (action === "setup") {
      // Create product + offer on Pepper (one-time setup)
      const productRes = await fetch(`${PEPPER_API_URL}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pepperToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "WhatsGuard Pro",
          description: "Plano mensal completo do WhatsGuard - Moderação automática para WhatsApp",
          sale_page: "https://guardian-group-bot.lovable.app",
          price: 10000,
        }),
      });

      const productData = await productRes.json();
      console.log("Pepper product created:", JSON.stringify(productData));

      return new Response(JSON.stringify({ success: true, data: productData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_pix") {
      const body = await req.json().catch(() => ({}));
      const { offer_hash, customer_name, customer_email, customer_document } = body;

      if (!offer_hash) {
        return new Response(JSON.stringify({ error: "offer_hash é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create PIX transaction
      const txRes = await fetch(`${PEPPER_API_URL}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pepperToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_token: pepperToken,
          amount: 10000,
          payment_method: "pix",
          cart: [{ offer_hash, price: 10000 }],
          customer: {
            name: customer_name || user.user_metadata?.display_name || "Cliente",
            email: customer_email || user.email,
            document: customer_document || "",
          },
        }),
      });

      const txData = await txRes.json();
      console.log("Pepper PIX transaction:", JSON.stringify(txData));

      if (txData.success && txData.data) {
        // Save subscription as pending
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await serviceClient.from("subscriptions").insert({
          user_id: user.id,
          status: "pending",
          pepper_transaction_id: txData.data.transaction_hash || txData.data.id || "",
          pix_code: txData.data.pix_code || txData.data.pix?.code || "",
          pix_qrcode: txData.data.pix_qrcode || txData.data.pix?.qrcode || "",
          amount: 10000,
        });

        return new Response(JSON.stringify({ success: true, data: txData.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: txData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List products to get offer_hash
    if (action === "list_products") {
      const res = await fetch(`${PEPPER_API_URL}/products`, {
        headers: {
          Authorization: `Bearer ${pepperToken}`,
          Accept: "application/json",
        },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pepper-checkout error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
