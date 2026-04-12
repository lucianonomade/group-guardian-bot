import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Evolution API sends events in different formats
    const event = body.event || body.data?.event;
    const messageData = body.data || body;
    
    // Only process group messages
    const isGroup = messageData?.key?.remoteJid?.endsWith("@g.us") ||
                    messageData?.message?.key?.remoteJid?.endsWith("@g.us");
    
    if (!isGroup) {
      return new Response(JSON.stringify({ status: "ignored", reason: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = messageData?.key || messageData?.message?.key;
    const groupJid = key?.remoteJid;
    const participantJid = key?.participant || messageData?.pushName;
    const messageId = key?.id;
    
    // Extract message text
    const msg = messageData?.message || messageData?.message?.message;
    const messageText = msg?.conversation ||
                        msg?.extendedTextMessage?.text ||
                        msg?.imageMessage?.caption ||
                        msg?.videoMessage?.caption || "";

    if (!groupJid || !participantJid || !messageText) {
      return new Response(JSON.stringify({ status: "ignored", reason: "missing data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the group in database
    const { data: group } = await supabase
      .from("groups")
      .select("*, instances(*)")
      .eq("group_jid", groupJid)
      .eq("is_monitored", true)
      .maybeSingle();

    if (!group) {
      return new Response(JSON.stringify({ status: "ignored", reason: "group not monitored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instance = group.instances;
    const userId = group.user_id;
    let violation: string | null = null;
    let violationType: string | null = null;

    // Check for links
    if (URL_REGEX.test(messageText)) {
      violation = "Envio de link";
      violationType = "link_deleted";
    }

    // Check for blocked words
    if (!violation) {
      const { data: blockedWords } = await supabase
        .from("blocked_words")
        .select("word")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (blockedWords) {
        const lowerMsg = messageText.toLowerCase();
        const found = blockedWords.find(bw => lowerMsg.includes(bw.word.toLowerCase()));
        if (found) {
          violation = `Palavra proibida: ${found.word}`;
          violationType = "word_deleted";
        }
      }
    }

    if (!violation || !violationType) {
      return new Response(JSON.stringify({ status: "ok", reason: "no violation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete the message via Evolution API
    try {
      await fetch(`${instance.api_url}/chat/deleteMessageForEveryone/${instance.name}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: instance.api_key,
        },
        body: JSON.stringify({
          id: messageId,
          remoteJid: groupJid,
          fromMe: false,
          participant: participantJid,
        }),
      });
    } catch (e) {
      console.error("Failed to delete message:", e);
    }

    // Count existing warnings for this participant in this group
    const { count: warningCount } = await supabase
      .from("warnings")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("participant_jid", participantJid);

    const currentWarnings = warningCount ?? 0;
    const newWarningNumber = currentWarnings + 1;

    // Log the action
    await supabase.from("action_logs").insert({
      user_id: userId,
      group_id: group.id,
      action_type: violationType,
      participant_jid: participantJid,
      participant_name: messageData?.pushName || null,
      details: `${violation} - Mensagem apagada`,
    });

    if (newWarningNumber >= 3) {
      // BAN - 3rd strike
      // Remove from group via Evolution API
      try {
        await fetch(`${instance.api_url}/group/updateParticipant/${instance.name}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            groupJid: groupJid,
            action: "remove",
            participants: [participantJid],
          }),
        });
      } catch (e) {
        console.error("Failed to remove participant:", e);
      }

      // Record ban
      await supabase.from("bans").insert({
        user_id: userId,
        group_id: group.id,
        participant_jid: participantJid,
        participant_name: messageData?.pushName || null,
        reason: `3 violações - Última: ${violation}`,
      });

      // Log ban action
      await supabase.from("action_logs").insert({
        user_id: userId,
        group_id: group.id,
        action_type: "ban",
        participant_jid: participantJid,
        participant_name: messageData?.pushName || null,
        details: `Banido após 3 violações`,
      });

      // Send ban message
      try {
        await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            number: groupJid,
            text: `🚫 *${messageData?.pushName || participantJid}* foi removido do grupo por violar as regras 3 vezes.\n\nMotivo da última violação: ${violation}`,
          }),
        });
      } catch (e) {
        console.error("Failed to send ban message:", e);
      }
    } else {
      // WARNING
      await supabase.from("warnings").insert({
        user_id: userId,
        group_id: group.id,
        participant_jid: participantJid,
        participant_name: messageData?.pushName || null,
        reason: violation,
        message_content: messageText.substring(0, 500),
        warning_number: newWarningNumber,
      });

      // Log warning action
      await supabase.from("action_logs").insert({
        user_id: userId,
        group_id: group.id,
        action_type: "warning",
        participant_jid: participantJid,
        participant_name: messageData?.pushName || null,
        details: `Aviso ${newWarningNumber}/2 - ${violation}`,
      });

      // Send warning message
      const remaining = 2 - newWarningNumber;
      try {
        await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            number: groupJid,
            text: `⚠️ *Aviso ${newWarningNumber}/2* para *${messageData?.pushName || participantJid}*\n\nMotivo: ${violation}\n\n${remaining > 0 ? `Você tem mais ${remaining} aviso(s) antes de ser removido do grupo.` : "⛔ Próxima violação resultará em *banimento* do grupo!"}`,
          }),
        });
      } catch (e) {
        console.error("Failed to send warning message:", e);
      }
    }

    return new Response(JSON.stringify({ status: "processed", action: newWarningNumber >= 3 ? "banned" : "warned", warningNumber: newWarningNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
