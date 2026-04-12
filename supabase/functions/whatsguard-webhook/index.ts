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
    
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Event:", body.event);
    console.log("Keys:", Object.keys(body));
    
    // Evolution API v2 format: { event, instance, data, ... }
    const event = body.event;
    
    // Only process message events
    if (event !== "messages.upsert") {
      console.log("Ignored event:", event);
      return new Response(JSON.stringify({ status: "ignored", reason: `event: ${event}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageData = body.data;
    console.log("Message data keys:", messageData ? Object.keys(messageData) : "null");
    
    console.log("Data structure:", JSON.stringify(messageData).substring(0, 1000));
    
    if (!messageData) {
      return new Response(JSON.stringify({ status: "ignored", reason: "no message data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evolution API v2 structure
    const key = messageData.key;
    const remoteJid = key?.remoteJid;
    const isGroup = remoteJid?.endsWith("@g.us");
    
    console.log("RemoteJid:", remoteJid, "isGroup:", isGroup);
    
    if (!isGroup) {
      return new Response(JSON.stringify({ status: "ignored", reason: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip messages sent by the bot itself
    if (key?.fromMe) {
      console.log("Skipping own message");
      return new Response(JSON.stringify({ status: "ignored", reason: "own message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groupJid = remoteJid;
    const participantJid = key?.participant || "";
    // participantAlt has the @s.whatsapp.net format needed for API calls
    const participantAlt = key?.participantAlt || participantJid;
    const messageId = key?.id;
    const pushName = messageData.pushName || "";
    
    // Extract message text from various message types
    const msg = messageData.message;
    const messageText = msg?.conversation ||
                        msg?.extendedTextMessage?.text ||
                        msg?.imageMessage?.caption ||
                        msg?.videoMessage?.caption || "";

    console.log("Participant:", participantJid, "PushName:", pushName);
    console.log("Message text:", messageText?.substring(0, 100));

    if (!groupJid || !participantJid || !messageText) {
      console.log("Missing data - groupJid:", !!groupJid, "participant:", !!participantJid, "text:", !!messageText);
      return new Response(JSON.stringify({ status: "ignored", reason: "missing data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the group in database
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("*, instances(*)")
      .eq("group_jid", groupJid)
      .eq("is_monitored", true)
      .maybeSingle();

    console.log("Group found:", !!group, "Error:", groupError?.message);

    if (!group) {
      return new Response(JSON.stringify({ status: "ignored", reason: "group not monitored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instance = group.instances;
    const userId = group.user_id;

    // Check whitelist - skip moderation for whitelisted participants
    const { data: whitelistEntry } = await supabase
      .from("whitelist")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", group.id)
      .eq("participant_jid", participantAlt)
      .maybeSingle();

    if (whitelistEntry) {
      console.log("Participant is whitelisted, skipping:", participantAlt);
      return new Response(JSON.stringify({ status: "ignored", reason: "whitelisted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        const found = blockedWords.find((bw: any) => lowerMsg.includes(bw.word.toLowerCase()));
        if (found) {
          violation = `Palavra proibida: ${found.word}`;
          violationType = "word_deleted";
        }
      }
    }

    if (!violation || !violationType) {
      console.log("No violation found");
      return new Response(JSON.stringify({ status: "ok", reason: "no violation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("VIOLATION DETECTED:", violation);

    // Delete the message via Evolution API
    try {
      const deleteRes = await fetch(`${instance.api_url}/chat/deleteMessageForEveryone/${instance.name}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: instance.api_key,
        },
        body: JSON.stringify({
          id: messageId,
          remoteJid: groupJid,
          fromMe: false,
          participant: participantAlt,
        }),
      });
      console.log("Delete message response:", deleteRes.status);
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

    console.log("Warning count:", currentWarnings, "-> new:", newWarningNumber);

    // Log the action
    await supabase.from("action_logs").insert({
      user_id: userId,
      group_id: group.id,
      action_type: violationType,
      participant_jid: participantJid,
      participant_name: pushName || null,
      details: `${violation} - Mensagem apagada`,
    });

    if (newWarningNumber >= 3) {
      // BAN - 3rd strike
      console.log("BANNING user:", participantJid, "using alt:", participantAlt);
      try {
        const banRes = await fetch(`${instance.api_url}/group/updateParticipant/${instance.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            groupJid: groupJid,
            action: "remove",
            participants: [participantAlt],
          }),
        });
        const banBody = await banRes.text();
        console.log("Ban response:", banRes.status, banBody);
      } catch (e) {
        console.error("Failed to remove participant:", e);
      }

      await supabase.from("bans").insert({
        user_id: userId,
        group_id: group.id,
        participant_jid: participantJid,
        participant_name: pushName || null,
        reason: `3 violações - Última: ${violation}`,
      });

      await supabase.from("action_logs").insert({
        user_id: userId,
        group_id: group.id,
        action_type: "ban",
        participant_jid: participantJid,
        participant_name: pushName || null,
        details: `Banido após 3 violações`,
      });

      try {
        await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            number: groupJid,
            text: `🚫 *${pushName || participantJid}* foi removido do grupo por violar as regras 3 vezes.\n\nMotivo da última violação: ${violation}`,
          }),
        });
      } catch (e) {
        console.error("Failed to send ban message:", e);
      }
    } else {
      // WARNING
      console.log("WARNING user:", participantJid, "warning #", newWarningNumber);
      await supabase.from("warnings").insert({
        user_id: userId,
        group_id: group.id,
        participant_jid: participantJid,
        participant_name: pushName || null,
        reason: violation,
        message_content: messageText.substring(0, 500),
        warning_number: newWarningNumber,
      });

      await supabase.from("action_logs").insert({
        user_id: userId,
        group_id: group.id,
        action_type: "warning",
        participant_jid: participantJid,
        participant_name: pushName || null,
        details: `Aviso ${newWarningNumber}/2 - ${violation}`,
      });

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
            text: `⚠️ *Aviso ${newWarningNumber}/2* para *${pushName || participantJid}*\n\nMotivo: ${violation}\n\n${remaining > 0 ? `Você tem mais ${remaining} aviso(s) antes de ser removido do grupo.` : "⛔ Próxima violação resultará em *banimento* do grupo!"}`,
          }),
        });
      } catch (e) {
        console.error("Failed to send warning message:", e);
      }
    }

    console.log("=== PROCESSED SUCCESSFULLY ===");
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
