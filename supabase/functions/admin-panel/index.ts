import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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

    // Verify user is admin
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

    // Check admin role using service client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // List all users with profiles and subscriptions
    if (action === "list_users") {
      const { data: profiles, error: profError } = await serviceClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profError) throw profError;

      const { data: subscriptions } = await serviceClient
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: roles } = await serviceClient
        .from("user_roles")
        .select("*");

      // Map subscriptions and roles to users
      const users = (profiles || []).map((p) => {
        const userSubs = (subscriptions || []).filter((s) => s.user_id === p.user_id);
        const activeSub = userSubs.find(
          (s) => s.status === "active" && s.expires_at && new Date(s.expires_at) > new Date()
        );
        const userRoles = (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role);

        return {
          ...p,
          subscriptions: userSubs,
          active_subscription: activeSub || null,
          roles: userRoles,
        };
      });

      return new Response(JSON.stringify({ success: true, data: users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Activate subscription for a user
    if (action === "activate_subscription") {
      const { target_user_id, days = 30 } = body;
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const { error } = await serviceClient.from("subscriptions").insert({
        user_id: target_user_id,
        status: "active",
        plan_name: "WhatsGuard Pro",
        amount: 10000,
        paid_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update subscription status
    if (action === "update_subscription") {
      const { subscription_id, status, expires_at } = body;
      if (!subscription_id || !status) {
        return new Response(JSON.stringify({ error: "subscription_id e status obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = { status };
      if (expires_at) updateData.expires_at = expires_at;
      if (status === "active" && !expires_at) {
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        updateData.expires_at = exp.toISOString();
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await serviceClient
        .from("subscriptions")
        .update(updateData)
        .eq("id", subscription_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel/deactivate subscription
    if (action === "cancel_subscription") {
      const { subscription_id } = body;
      if (!subscription_id) {
        return new Response(JSON.stringify({ error: "subscription_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await serviceClient
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscription_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
