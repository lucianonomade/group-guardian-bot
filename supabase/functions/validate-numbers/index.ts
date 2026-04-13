import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { numbers, instanceId } = await req.json();

    if (!numbers || !Array.isArray(numbers) || !instanceId) {
      return new Response(JSON.stringify({ error: "Envie numbers (array) e instanceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance
    const { data: instance, error: instErr } = await supabase
      .from("instances")
      .select("*")
      .eq("id", instanceId)
      .eq("user_id", user.id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean numbers - only digits
    const cleanNumbers = numbers
      .map((n: string) => n.replace(/\D/g, ""))
      .filter((n: string) => n.length >= 10 && n.length <= 15);

    if (!cleanNumbers.length) {
      return new Response(JSON.stringify({ error: "Nenhum número válido fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Evolution API to check numbers
    const results: Array<{ number: string; exists: boolean; jid: string | null }> = [];
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < cleanNumbers.length; i += batchSize) {
      const batch = cleanNumbers.slice(i, i + batchSize);
      
      const res = await fetch(
        `${instance.api_url}/chat/whatsappNumbers/${instance.name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({ numbers: batch }),
        }
      );

      if (!res.ok) {
        console.error("Evolution API error:", await res.text());
        // Mark all in batch as unknown
        for (const num of batch) {
          results.push({ number: num, exists: false, jid: null });
        }
        continue;
      }

      const data = await res.json();
      console.log("Evolution response:", JSON.stringify(data));

      // Parse response - Evolution API returns array of objects with exists, jid, number
      if (Array.isArray(data)) {
        for (const item of data) {
          results.push({
            number: item.number || item.phoneNumber || "",
            exists: item.exists === true || item.status === "valid",
            jid: item.jid || null,
          });
        }
      } else if (data && typeof data === "object") {
        // Some versions return { result: [...] } or similar
        const items = data.result || data.data || data.numbers || [];
        if (Array.isArray(items)) {
          for (const item of items) {
            results.push({
              number: item.number || item.phoneNumber || "",
              exists: item.exists === true || item.status === "valid",
              jid: item.jid || null,
            });
          }
        }
      }
    }

    // Fill in any numbers not in results
    const resultNumbers = new Set(results.map(r => r.number));
    for (const num of cleanNumbers) {
      if (!resultNumbers.has(num)) {
        results.push({ number: num, exists: false, jid: null });
      }
    }

    return new Response(JSON.stringify({
      total: cleanNumbers.length,
      valid: results.filter(r => r.exists).length,
      invalid: results.filter(r => !r.exists).length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
