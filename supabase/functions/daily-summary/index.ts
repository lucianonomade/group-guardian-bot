import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all monitored groups with their instances
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("*, instances(*)")
      .eq("is_monitored", true);

    if (groupsError || !groups || groups.length === 0) {
      console.log("No monitored groups found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    let processedCount = 0;

    for (const group of groups) {
      try {
        // Check if summary already exists for today
        const { data: existing } = await supabase
          .from("daily_summaries")
          .select("id")
          .eq("group_id", group.id)
          .eq("date", today)
          .maybeSingle();

        if (existing) {
          console.log(`Summary already exists for group ${group.name} on ${today}`);
          continue;
        }

        // Fetch action logs for today
        const { data: logs } = await supabase
          .from("action_logs")
          .select("*")
          .eq("group_id", group.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay)
          .order("created_at", { ascending: true });

        const dayLogs = logs || [];

        // Count actions by type
        const actionCounts: Record<string, number> = {};
        const activeMembers: Record<string, { name: string; count: number }> = {};

        for (const log of dayLogs) {
          actionCounts[log.action_type] = (actionCounts[log.action_type] || 0) + 1;
          if (log.participant_jid) {
            const key = log.participant_jid;
            if (!activeMembers[key]) {
              activeMembers[key] = { name: log.participant_name || key.split("@")[0], count: 0 };
            }
            activeMembers[key].count++;
          }
        }

        // Build prompt for AI
        const prompt = `Você é um assistente que gera resumos diários de moderação de grupos do WhatsApp em português brasileiro.

Grupo: ${group.name}
Data: ${today}
Total de membros: ${group.participant_count || "desconhecido"}

Ações do dia:
- Avisos dados: ${actionCounts["warning"] || 0}
- Banimentos: ${actionCounts["ban"] || 0}
- Links removidos: ${actionCounts["link_deleted"] || 0}
- Palavras proibidas removidas: ${actionCounts["word_deleted"] || 0}
- Flood detectado: ${actionCounts["flood"] || 0}
- Desbanimentos: ${actionCounts["unban"] || 0}
- Avisos resetados: ${actionCounts["unwarn"] || 0}

${dayLogs.length === 0 ? "Nenhuma ação de moderação registrada hoje." : ""}

Membros mais envolvidos em moderação:
${Object.entries(activeMembers)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5)
  .map(([_, m]) => `- ${m.name}: ${m.count} ação(ões)`)
  .join("\n") || "Nenhum"}

Gere um resumo curto e objetivo (máximo 500 caracteres) do dia de moderação do grupo. Use emojis. Se não houve atividade, mencione que foi um dia tranquilo.`;

        // Call AI Gateway
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Você gera resumos concisos de moderação de grupos WhatsApp. Responda apenas com o resumo, sem markdown." },
              { role: "user", content: prompt },
            ],
          }),
        });

        let summaryText = "";
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          summaryText = aiData.choices?.[0]?.message?.content || "";
        }

        if (!summaryText) {
          // Fallback summary
          const total = dayLogs.length;
          summaryText = total === 0
            ? `✅ Dia tranquilo no grupo ${group.name}! Nenhuma ação de moderação necessária.`
            : `📊 Resumo: ${actionCounts["warning"] || 0} avisos, ${actionCounts["ban"] || 0} bans, ${actionCounts["link_deleted"] || 0} links removidos. Total: ${total} ação(ões).`;
        }

        // Save to database
        const membersActiveArr = Object.entries(activeMembers)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([jid, m]) => ({ jid, name: m.name, actions: m.count }));

        await supabase.from("daily_summaries").insert({
          group_id: group.id,
          user_id: group.user_id,
          summary_text: summaryText,
          date: today,
          members_active: membersActiveArr,
        });

        // Save group snapshot
        await supabase.from("group_snapshots").upsert({
          group_id: group.id,
          user_id: group.user_id,
          participant_count: group.participant_count || 0,
          snapshot_date: today,
        }, { onConflict: "group_id,snapshot_date" });

        // Send summary to WhatsApp group
        const instance = group.instances;
        if (instance && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          try {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key || EVOLUTION_API_KEY },
              body: JSON.stringify({
                number: group.group_jid,
                text: `📊 *Resumo Diário — ${group.name}*\n📅 ${today}\n\n${summaryText}`,
              }),
            });
          } catch (e) {
            console.error(`Failed to send summary to ${group.name}:`, e);
          }
        }

        processedCount++;
        console.log(`Summary generated for ${group.name}`);
      } catch (e) {
        console.error(`Error processing group ${group.name}:`, e);
      }
    }

    return new Response(JSON.stringify({ processed: processedCount, total: groups.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Daily summary error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
