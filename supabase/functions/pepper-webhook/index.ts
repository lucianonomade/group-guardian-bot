import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Pepper webhook received:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle transaction status updates
    const transactionHash = payload.transaction_hash || payload.data?.transaction_hash || payload.id;
    const status = payload.status || payload.data?.status;

    if (!transactionHash) {
      console.log("No transaction hash found in webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing transaction ${transactionHash} with status ${status}`);

    if (status === "approved" || status === "paid" || status === "completed") {
      // Activate subscription
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          paid_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("pepper_transaction_id", transactionHash);

      if (error) {
        console.error("Error updating subscription:", error);
      } else {
        console.log(`Subscription activated for transaction ${transactionHash}`);
      }
    } else if (status === "refunded" || status === "cancelled" || status === "chargeback") {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("pepper_transaction_id", transactionHash);

      if (error) {
        console.error("Error cancelling subscription:", error);
      }
    } else if (status === "expired") {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("pepper_transaction_id", transactionHash);

      if (error) {
        console.error("Error expiring subscription:", error);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
