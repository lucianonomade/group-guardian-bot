import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

// Anti-flood in-memory cache: Map<"groupJid:participantJid", { count, firstMessageAt }>
const floodCache = new Map<string, { count: number; firstMessageAt: number }>();

// Cleanup old flood entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of floodCache) {
    if (now - val.firstMessageAt > 120_000) floodCache.delete(key);
  }
}, 60_000);

// Helper: check if participant is admin in the group
async function isParticipantAdmin(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  groupJid: string,
  participantJid: string
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=true`, {
      headers: { "Content-Type": "application/json", apikey: apiKey },
    });
    if (!res.ok) return false;
    const raw = await res.json();
    const groups = Array.isArray(raw) ? raw : raw?.data || [];
    const group = groups.find((g: any) => (g.id || g.jid) === groupJid);
    if (!group) return false;
    const participants = group.participants || [];
    return participants.some(
      (p: any) =>
        (p.id === participantJid || p.phoneNumber === participantJid) &&
        (p.admin === "admin" || p.admin === "superadmin")
    );
  } catch {
    return false;
  }
}

// Helper: extract mentioned JID from message
function extractMentionedJid(messageData: any, text: string): string | null {
  // Check Evolution API mentions
  const contextInfo = messageData?.message?.extendedTextMessage?.contextInfo;
  const mentioned = contextInfo?.mentionedJid;
  if (mentioned && mentioned.length > 0) return mentioned[0];

  // Try to extract from text: !ban 5511999999999
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) {
    const target = parts[1].replace(/[@+]/g, "");
    if (/^\d{10,15}$/.test(target)) return `${target}@s.whatsapp.net`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Event:", body.event);

    const event = body.event;

    // Handle group participant events (welcome message)
    if (event === "group.participants.update" || event === "groups.participants.update") {
      const action = body.data?.action;
      const participants = body.data?.participants || [];
      const groupJid = body.data?.id || body.data?.groupJid;

      if (action === "add" && groupJid && participants.length > 0) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: group } = await supabase
          .from("groups")
          .select("*, instances(*)")
          .eq("group_jid", groupJid)
          .eq("is_monitored", true)
          .maybeSingle();

        if (group?.welcome_message && group.instances) {
          const instance = group.instances;
          for (const participant of participants) {
            const pJid = typeof participant === "string" ? participant : participant.id || participant;
            const pName = pJid.split("@")[0];
            const text = group.welcome_message.replace(/\{\{nome\}\}/gi, pName);

            try {
              await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: instance.api_key },
                body: JSON.stringify({ number: groupJid, text }),
              });
              console.log("Welcome message sent to", pJid, "in", groupJid);
            } catch (e) {
              console.error("Failed to send welcome message:", e);
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "processed", action: "welcome" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process message events
    if (event !== "messages.upsert") {
      console.log("Ignored event:", event);
      return new Response(JSON.stringify({ status: "ignored", reason: `event: ${event}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageData = body.data;
    if (!messageData) {
      return new Response(JSON.stringify({ status: "ignored", reason: "no message data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DEBUG: Log the full data structure to understand Evolution API format
    console.log("FULL DATA KEYS:", JSON.stringify(Object.keys(messageData)));
    const msgObj = messageData.message;
    console.log("MESSAGE KEYS:", msgObj ? JSON.stringify(Object.keys(msgObj)) : "null");
    console.log("messageType:", messageData.messageType);
    console.log("CONVERSATION VALUE:", JSON.stringify(msgObj?.conversation));
    console.log("CONVERSATION TYPE:", typeof msgObj?.conversation);
    console.log("RAW KEY FIELD:", JSON.stringify(messageData.key));

    const key = messageData.key;
    const remoteJid = key?.remoteJid;
    const isGroup = remoteJid?.endsWith("@g.us");

    if (!isGroup) {
      return new Response(JSON.stringify({ status: "ignored", reason: "not a group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text BEFORE fromMe check so we can allow commands from bot owner
    const msg = messageData.message;
    const messageText = msg?.conversation ||
                        msg?.extendedTextMessage?.text ||
                        msg?.imageMessage?.caption ||
                        msg?.videoMessage?.caption ||
                        msg?.buttonsResponseMessage?.selectedDisplayText ||
                        msg?.listResponseMessage?.title ||
                        msg?.templateButtonReplyMessage?.selectedDisplayText ||
                        messageData.body ||
                        messageData.text ||
                        "";

    // Skip own messages UNLESS it's a command (bot owner sending commands)
    if (key?.fromMe && !messageText.trim().startsWith("!")) {
      return new Response(JSON.stringify({ status: "ignored", reason: "own message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groupJid = remoteJid;
    const participantJid = key?.participant || "";
    const participantAlt = key?.participantAlt || participantJid;
    const messageId = key?.id;
    const pushName = messageData.pushName || "";

    // messageText already extracted above (before fromMe check)

    console.log("Participant:", participantJid, "PushName:", pushName);
    console.log("Message text extracted:", JSON.stringify(messageText)?.substring(0, 200));

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

    // ========================
    // COMMAND HANDLING (!ban, !warn, !unwarn)
    // ========================
    if (messageText.startsWith("!")) {
      const parts = messageText.trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const supportedCommands = ["!ban", "!warn", "!unwarn"];

      if (supportedCommands.includes(command)) {
        console.log("Command detected:", command, "from", participantJid);

        // Verify sender is admin
        const senderIsAdmin = await isParticipantAdmin(
          instance.api_url, instance.api_key, instance.name, groupJid, participantAlt
        );

        if (!senderIsAdmin) {
          console.log("Non-admin tried command:", participantJid);
          try {
            await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({
                number: groupJid,
                text: `⚠️ @${pushName || participantJid.split("@")[0]}, apenas administradores podem usar comandos.`,
              }),
            });
          } catch (_) { /* ignore */ }
          return new Response(JSON.stringify({ status: "ignored", reason: "not admin" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const targetJid = extractMentionedJid(messageData, messageText);
        if (!targetJid) {
          await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({
              number: groupJid,
              text: `⚠️ Uso: ${command} @usuario ${command === "!warn" ? "[motivo]" : ""}`,
            }),
          });
          return new Response(JSON.stringify({ status: "error", reason: "no target" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const targetName = targetJid.split("@")[0];
        const reason = parts.slice(2).join(" ") || "Comando manual de admin";

        if (command === "!ban") {
          // Remove from group
          try {
            await fetch(`${instance.api_url}/group/updateParticipant/${instance.name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({ groupJid, action: "remove", participants: [targetJid] }),
            });
          } catch (e) {
            console.error("Failed to remove:", e);
          }

          await supabase.from("bans").insert({
            user_id: userId, group_id: group.id, participant_jid: targetJid,
            participant_name: targetName, reason: `Comando !ban: ${reason}`,
          });
          await supabase.from("action_logs").insert({
            user_id: userId, group_id: group.id, action_type: "ban",
            participant_jid: targetJid, participant_name: targetName,
            details: `Banido via comando por ${pushName}: ${reason}`,
          });

          await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({
              number: groupJid,
              text: `🚫 *${targetName}* foi banido do grupo por *${pushName}*.\nMotivo: ${reason}`,
            }),
          });

          return new Response(JSON.stringify({ status: "processed", action: "command_ban" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (command === "!warn") {
          const { count } = await supabase
            .from("warnings").select("id", { count: "exact", head: true })
            .eq("group_id", group.id).eq("participant_jid", targetJid);
          const newWarning = (count ?? 0) + 1;

          await supabase.from("warnings").insert({
            user_id: userId, group_id: group.id, participant_jid: targetJid,
            participant_name: targetName, reason: `Comando !warn: ${reason}`,
            warning_number: newWarning,
          });
          await supabase.from("action_logs").insert({
            user_id: userId, group_id: group.id, action_type: "warning",
            participant_jid: targetJid, participant_name: targetName,
            details: `Aviso ${newWarning} via comando por ${pushName}: ${reason}`,
          });

          await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({
              number: groupJid,
              text: `⚠️ *Aviso ${newWarning}/2* para *${targetName}*\nMotivo: ${reason}\nAplicado por: *${pushName}*`,
            }),
          });

          return new Response(JSON.stringify({ status: "processed", action: "command_warn" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (command === "!unwarn") {
          const { count } = await supabase
            .from("warnings").select("id", { count: "exact", head: true })
            .eq("group_id", group.id).eq("participant_jid", targetJid);

          await supabase.from("warnings").delete()
            .eq("group_id", group.id).eq("participant_jid", targetJid);

          await supabase.from("action_logs").insert({
            user_id: userId, group_id: group.id, action_type: "unwarn",
            participant_jid: targetJid, participant_name: targetName,
            details: `${count ?? 0} avisos resetados via comando por ${pushName}`,
          });

          await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({
              number: groupJid,
              text: `✅ Todos os avisos de *${targetName}* foram resetados por *${pushName}*.`,
            }),
          });

          return new Response(JSON.stringify({ status: "processed", action: "command_unwarn" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // If no text at all (media without caption and not a command), skip
    if (!groupJid || !participantJid || !messageText) {
      return new Response(JSON.stringify({ status: "ignored", reason: "missing data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check whitelist
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

    // ========================
    // ANTI-FLOOD CHECK
    // ========================
    let floodViolation = false;
    const { data: floodSettings } = await supabase
      .from("antiflood_settings")
      .select("*")
      .eq("group_id", group.id)
      .maybeSingle();

    if (floodSettings?.is_enabled) {
      const cacheKey = `${groupJid}:${participantJid}`;
      const now = Date.now();
      const entry = floodCache.get(cacheKey);
      const windowMs = (floodSettings.time_window_seconds || 10) * 1000;

      if (entry && now - entry.firstMessageAt < windowMs) {
        entry.count++;
        if (entry.count > (floodSettings.max_messages || 5)) {
          floodViolation = true;
          floodCache.delete(cacheKey); // Reset after violation
        }
      } else {
        floodCache.set(cacheKey, { count: 1, firstMessageAt: now });
      }
    }

    let violation: string | null = null;
    let violationType: string | null = null;

    if (floodViolation) {
      violation = "Flood / spam de mensagens";
      violationType = "flood";
    }

    // Check for links
    if (!violation && URL_REGEX.test(messageText)) {
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
      await fetch(`${instance.api_url}/chat/deleteMessageForEveryone/${instance.name}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", apikey: instance.api_key },
        body: JSON.stringify({
          id: messageId, remoteJid: groupJid, fromMe: false, participant: participantAlt,
        }),
      });
    } catch (e) {
      console.error("Failed to delete message:", e);
    }

    // Count existing warnings
    const { count: warningCount } = await supabase
      .from("warnings")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("participant_jid", participantJid);

    const currentWarnings = warningCount ?? 0;
    const newWarningNumber = currentWarnings + 1;

    await supabase.from("action_logs").insert({
      user_id: userId, group_id: group.id, action_type: violationType,
      participant_jid: participantJid, participant_name: pushName || null,
      details: `${violation} - Mensagem apagada`,
    });

    if (newWarningNumber >= 3) {
      // BAN
      try {
        await fetch(`${instance.api_url}/group/updateParticipant/${instance.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: instance.api_key },
          body: JSON.stringify({ groupJid, action: "remove", participants: [participantAlt] }),
        });
      } catch (e) {
        console.error("Failed to remove participant:", e);
      }

      await supabase.from("bans").insert({
        user_id: userId, group_id: group.id, participant_jid: participantJid,
        participant_name: pushName || null, reason: `3 violações - Última: ${violation}`,
      });
      await supabase.from("action_logs").insert({
        user_id: userId, group_id: group.id, action_type: "ban",
        participant_jid: participantJid, participant_name: pushName || null,
        details: `Banido após 3 violações`,
      });

      try {
        await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: instance.api_key },
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
      await supabase.from("warnings").insert({
        user_id: userId, group_id: group.id, participant_jid: participantJid,
        participant_name: pushName || null, reason: violation,
        message_content: messageText.substring(0, 500), warning_number: newWarningNumber,
      });
      await supabase.from("action_logs").insert({
        user_id: userId, group_id: group.id, action_type: "warning",
        participant_jid: participantJid, participant_name: pushName || null,
        details: `Aviso ${newWarningNumber}/2 - ${violation}`,
      });

      const remaining = 2 - newWarningNumber;
      try {
        await fetch(`${instance.api_url}/message/sendText/${instance.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: instance.api_key },
          body: JSON.stringify({
            number: groupJid,
            text: `⚠️ *Aviso ${newWarningNumber}/2* para *${pushName || participantJid}*\n\nMotivo: ${violation}\n\n${remaining > 0 ? `Você tem mais ${remaining} aviso(s) antes de ser removido do grupo.` : "⛔ Próxima violação resultará em *banimento* do grupo!"}`,
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
