import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WARMUP_MESSAGES = [
  "Oi, tudo bem?",
  "Bom dia! Como vai?",
  "Boa tarde!",
  "E aí, beleza?",
  "Opa, tudo certo?",
  "Olá! Como estão as coisas?",
  "Fala, tranquilo?",
  "Oi! Tudo tranquilo por aí?",
  "Hey, como você está?",
  "Boa noite! Tudo bem?",
  "😊",
  "👍",
  "Oi!",
  "Beleza?",
  "Tudo certo!",
  "Show!",
  "Legal!",
  "Combinado!",
  "Ok, entendi",
  "Perfeito!",
  "Valeu!",
  "Obrigado!",
  "Pode ser sim",
  "Depois a gente conversa",
  "Vou ver aqui e te aviso",
];

function getRandomMessage(customMessages: string[]): string {
  const pool = customMessages.length > 0 ? customMessages : WARMUP_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomImage(imageUrls: string[]): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  // 30% chance to send an image instead of text
  if (Math.random() > 0.3) return null;
  return imageUrls[Math.floor(Math.random() * imageUrls.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active warmup tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("warmup_tasks")
      .select("*, instances(*)")
      .eq("status", "active");

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return new Response(JSON.stringify({ error: "Erro ao buscar tarefas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma tarefa ativa", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const task of tasks) {
      const instance = task.instances;
      if (!instance) continue;

      const plan = (task.schedule_plan as any[]) || [];
      const currentDayPlan = plan.find((p: any) => p.day === task.current_day);
      const maxMessages = currentDayPlan?.messages || task.max_messages_today;

      // Check if already sent enough today
      if (task.messages_today >= maxMessages) {
        // Check if we should advance to next day
        const startDate = new Date(task.started_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (daysDiff > task.current_day) {
          if (daysDiff > task.total_days) {
            // Completed
            await supabase.from("warmup_tasks").update({ status: "completed" }).eq("id", task.id);
            continue;
          }
          // Advance day
          const nextPlan = plan.find((p: any) => p.day === daysDiff);
          await supabase.from("warmup_tasks").update({
            current_day: daysDiff,
            messages_today: 0,
            max_messages_today: nextPlan?.messages || maxMessages,
          }).eq("id", task.id);
        }
        continue;
      }

      // Send one message per invocation to spread out
      const targetNumber = task.target_numbers[Math.floor(Math.random() * task.target_numbers.length)];
      const customMsgs: string[] = task.custom_messages || [];
      const imgUrls: string[] = task.image_urls || [];
      const imageUrl = getRandomImage(imgUrls);
      const message = getRandomMessage(customMsgs);

      try {
        let res: Response;
        let sentContent = message;

        if (imageUrl) {
          // Send image with optional caption
          res = await fetch(
            `${instance.api_url}/message/sendMedia/${instance.name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: instance.api_key,
              },
              body: JSON.stringify({
                number: targetNumber,
                mediatype: "image",
                media: imageUrl,
                caption: message,
              }),
            }
          );
          sentContent = `[IMG] ${message}`;
        } else {
          res = await fetch(
            `${instance.api_url}/message/sendText/${instance.name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: instance.api_key,
              },
              body: JSON.stringify({
                number: targetNumber,
                text: message,
              }),
            }
          );
        }

        if (res.ok) {
          totalSent++;
          await supabase.from("warmup_tasks").update({
            messages_today: task.messages_today + 1,
            last_message_at: new Date().toISOString(),
          }).eq("id", task.id);
          // Log success
          await supabase.from("warmup_logs").insert({
            user_id: task.user_id,
            warmup_task_id: task.id,
            target_number: targetNumber,
            message_text: message,
            status: "sent",
            day_number: task.current_day,
          });
        } else {
          const errText = await res.text();
          console.error(`Failed to send to ${targetNumber}:`, errText);
          // Log error
          await supabase.from("warmup_logs").insert({
            user_id: task.user_id,
            warmup_task_id: task.id,
            target_number: targetNumber,
            message_text: message,
            status: "error",
            error_details: errText.slice(0, 500),
            day_number: task.current_day,
          });
        }
      } catch (err) {
        console.error(`Error sending message for task ${task.id}:`, err);
      }

      // Small delay between tasks
      await sleep(2000);
    }

    return new Response(JSON.stringify({
      message: "Processamento concluído",
      processed: tasks.length,
      sent: totalSent,
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
