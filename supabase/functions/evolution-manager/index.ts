const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVOLUTION_API_URL = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const evoHeaders = { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY }

    // CREATE INSTANCE
    if (action === 'create' && req.method === 'POST') {
      const { instanceName } = await req.json()
      if (!instanceName || typeof instanceName !== 'string' || instanceName.length < 2) {
        return new Response(JSON.stringify({ error: 'Nome da instância inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const name = instanceName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')

      // Create instance on Evolution API
      const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({
          instanceName: name,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      })

      const createData = await createRes.json()
      console.log('Create instance response:', JSON.stringify(createData))

      if (!createRes.ok) {
        // Instance might already exist, try to connect
        if (createData?.error?.includes?.('already') || createData?.message?.includes?.('already') || createRes.status === 403) {
          // Try to get QR code for existing instance
          const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${name}`, {
            method: 'GET',
            headers: evoHeaders,
          })
          const connectData = await connectRes.json()
          console.log('Connect existing response:', JSON.stringify(connectData))

          // Save to database
          const serviceSupabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )

          const { data: existing } = await serviceSupabase
            .from('instances')
            .select('id')
            .eq('name', name)
            .eq('user_id', user.id)
            .maybeSingle()

          if (!existing) {
            await serviceSupabase.from('instances').insert({
              user_id: user.id,
              name,
              api_url: EVOLUTION_API_URL,
              api_key: EVOLUTION_API_KEY,
              is_connected: false,
            })
          }

          const qrcode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null
          const pairingCode = connectData?.pairingCode || null

          return new Response(JSON.stringify({ 
            success: true, 
            instanceName: name, 
            qrcode, 
            pairingCode,
            status: 'connecting' 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: createData?.message || 'Erro ao criar instância' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Save instance to database
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      await serviceSupabase.from('instances').insert({
        user_id: user.id,
        name,
        api_url: EVOLUTION_API_URL,
        api_key: EVOLUTION_API_KEY,
        is_connected: false,
      })

      // Set webhook URL
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsguard-webhook`
      await fetch(`${EVOLUTION_API_URL}/webhook/set/${name}`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'MESSAGES_UPSERT',
            'CONNECTION_UPDATE',
          ],
        }),
      })

      const qrcode = createData?.qrcode?.base64 || createData?.base64 || createData?.instance?.qrcode?.base64 || null
      const pairingCode = createData?.pairingCode || null

      return new Response(JSON.stringify({ 
        success: true, 
        instanceName: name, 
        qrcode,
        pairingCode,
        status: 'connecting' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET QR CODE
    if (action === 'qrcode') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: evoHeaders,
      })
      const data = await res.json()
      console.log('QR code response:', JSON.stringify(data))

      const qrcode = data?.base64 || data?.qrcode?.base64 || data?.code || null
      const pairingCode = data?.pairingCode || null

      return new Response(JSON.stringify({ qrcode, pairingCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // CHECK CONNECTION STATUS
    if (action === 'status') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: evoHeaders,
      })
      const data = await res.json()
      const connected = data?.state === 'open' || data?.instance?.state === 'open'

      // Update database
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await serviceSupabase
        .from('instances')
        .update({ is_connected: connected })
        .eq('name', instanceName)
        .eq('user_id', user.id)

      // If just connected, set webhook
      if (connected) {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsguard-webhook`
        await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: evoHeaders,
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          }),
        })
      }

      return new Response(JSON.stringify({ connected, state: data?.state || data?.instance?.state }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE INSTANCE
    if (action === 'delete' && req.method === 'DELETE') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Delete from Evolution API
      try {
        await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: evoHeaders,
        })
      } catch (e) {
        console.log('Evolution delete error (non-fatal):', e)
      }

      // Delete from database
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await serviceSupabase
        .from('instances')
        .delete()
        .eq('name', instanceName)
        .eq('user_id', user.id)

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Evolution manager error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
