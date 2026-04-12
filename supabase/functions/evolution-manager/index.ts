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

      const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({ instanceName: name, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
      })
      const createData = await createRes.json()
      console.log('Create instance response:', JSON.stringify(createData))

      if (!createRes.ok) {
        if (createData?.error?.includes?.('already') || createData?.message?.includes?.('already') || createRes.status === 403) {
          const connectRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${name}`, { method: 'GET', headers: evoHeaders })
          const connectData = await connectRes.json()

          const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
          const { data: existing } = await serviceSupabase.from('instances').select('id').eq('name', name).eq('user_id', user.id).maybeSingle()
          if (!existing) {
            await serviceSupabase.from('instances').insert({ user_id: user.id, name, api_url: EVOLUTION_API_URL, api_key: EVOLUTION_API_KEY, is_connected: false })
          }

          const qrcode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null
          const pairingCode = connectData?.pairingCode || null
          return new Response(JSON.stringify({ success: true, instanceName: name, qrcode, pairingCode, status: 'connecting' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ error: createData?.message || 'Erro ao criar instância' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await serviceSupabase.from('instances').insert({ user_id: user.id, name, api_url: EVOLUTION_API_URL, api_key: EVOLUTION_API_KEY, is_connected: false })

      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsguard-webhook`
      await fetch(`${EVOLUTION_API_URL}/webhook/set/${name}`, {
        method: 'POST', headers: evoHeaders,
        body: JSON.stringify({ url: webhookUrl, webhook_by_events: false, webhook_base64: false, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'GROUPS_PARTICIPANTS_UPDATE'] }),
      })

      const qrcode = createData?.qrcode?.base64 || createData?.base64 || createData?.instance?.qrcode?.base64 || null
      const pairingCode = createData?.pairingCode || null
      return new Response(JSON.stringify({ success: true, instanceName: name, qrcode, pairingCode, status: 'connecting' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET QR CODE
    if (action === 'qrcode') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, { method: 'GET', headers: evoHeaders })
      const data = await res.json()
      const qrcode = data?.base64 || data?.qrcode?.base64 || data?.code || null
      const pairingCode = data?.pairingCode || null
      return new Response(JSON.stringify({ qrcode, pairingCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // CHECK CONNECTION STATUS
    if (action === 'status') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, { method: 'GET', headers: evoHeaders })
      const data = await res.json()
      const connected = data?.state === 'open' || data?.instance?.state === 'open'

      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await serviceSupabase.from('instances').update({ is_connected: connected }).eq('name', instanceName).eq('user_id', user.id)

      if (connected) {
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsguard-webhook`
        await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
          method: 'POST', headers: evoHeaders,
          body: JSON.stringify({ url: webhookUrl, webhook_by_events: false, webhook_base64: false, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'GROUPS_PARTICIPANTS_UPDATE'] }),
        })
      }

      return new Response(JSON.stringify({ connected, state: data?.state || data?.instance?.state }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE INSTANCE
    if (action === 'delete' && req.method === 'DELETE') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      try { await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers: evoHeaders }) } catch (e) { console.log('Evolution delete error (non-fatal):', e) }
      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await serviceSupabase.from('instances').delete().eq('name', instanceName).eq('user_id', user.id)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // SYNC GROUPS
    if (action === 'sync-groups') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: instance } = await serviceSupabase.from('instances').select('*').eq('name', instanceName).eq('user_id', user.id).maybeSingle()
      if (!instance) return new Response(JSON.stringify({ error: 'Instance not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const groupsRes = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${instanceName}?getParticipants=true`, { headers: evoHeaders })
      if (!groupsRes.ok) return new Response(JSON.stringify({ error: 'Failed to fetch groups' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const groupsRaw = await groupsRes.json()
      const groupsData = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw?.data || []

      const infoRes = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: evoHeaders })
      const instancesData = await infoRes.json()
      const thisInstance = Array.isArray(instancesData) ? instancesData.find((i: any) => i.name === instanceName) : null
      const ownerJid = thisInstance?.ownerJid || ''

      let syncedCount = 0
      const adminJids = new Set<string>()

      for (const g of groupsData) {
        const jid = g.id || g.jid
        const name = g.subject || g.name || jid
        const count = g.size || g.participants?.length || 0
        const participants = g.participants || []
        const isAdmin = participants.some((p: any) => (p.phoneNumber === ownerJid || p.id === ownerJid) && (p.admin === 'admin' || p.admin === 'superadmin'))
        if (!isAdmin) continue
        adminJids.add(jid)
        syncedCount++

        const { data: existing } = await serviceSupabase.from('groups').select('id').eq('group_jid', jid).eq('instance_id', instance.id).maybeSingle()
        if (existing) {
          await serviceSupabase.from('groups').update({ name, participant_count: count }).eq('id', existing.id)
        } else {
          await serviceSupabase.from('groups').insert({ user_id: user.id, instance_id: instance.id, group_jid: jid, name, participant_count: count, is_monitored: true })
        }
      }

      const { data: existingGroups } = await serviceSupabase.from('groups').select('id, group_jid').eq('instance_id', instance.id)
      if (existingGroups) {
        for (const eg of existingGroups) {
          if (!adminJids.has(eg.group_jid)) await serviceSupabase.from('groups').delete().eq('id', eg.id)
        }
      }

      return new Response(JSON.stringify({ success: true, synced: syncedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // FETCH ALL GROUPS (for broadcast - no admin filter)
    if (action === 'fetch-all-groups') {
      const instanceName = url.searchParams.get('instanceName')
      if (!instanceName) return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const groupsRes = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${instanceName}?getParticipants=false`, { headers: evoHeaders })
      if (!groupsRes.ok) {
        const errBody = await groupsRes.text()
        return new Response(JSON.stringify({ error: 'Failed to fetch groups', status: groupsRes.status, detail: errBody }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const groupsRaw = await groupsRes.json()
      const groupsData = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw?.data || []
      const groups = groupsData.map((g: any) => ({ jid: g.id || g.jid, name: g.subject || g.name || g.id || g.jid, size: g.size || g.participants?.length || 0 }))
      return new Response(JSON.stringify({ groups }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // FETCH GROUP PARTICIPANTS
    if (action === 'fetch-group-participants') {
      const instanceName = url.searchParams.get('instanceName')
      const groupJid = url.searchParams.get('groupJid')
      if (!instanceName || !groupJid) {
        return new Response(JSON.stringify({ error: 'instanceName and groupJid required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const groupsRes = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${instanceName}?getParticipants=true`, { headers: evoHeaders })
      if (!groupsRes.ok) {
        const errBody = await groupsRes.text()
        return new Response(JSON.stringify({ error: 'Failed to fetch groups', detail: errBody }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const groupsRaw = await groupsRes.json()
      const groupsData = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw?.data || []
      const targetGroup = groupsData.find((g: any) => (g.id || g.jid) === groupJid)

      if (!targetGroup) {
        return new Response(JSON.stringify({ error: 'Group not found', participants: [] }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const participants = (targetGroup.participants || []).map((p: any) => ({
        jid: p.id || p.phoneNumber || '',
        name: p.name || p.pushName || (p.id || p.phoneNumber || '').split('@')[0],
        admin: p.admin || null,
      }))

      return new Response(JSON.stringify({ participants, groupName: targetGroup.subject || targetGroup.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // SEND BROADCAST
    if (action === 'send-broadcast' && req.method === 'POST') {
      const { broadcastId } = await req.json()
      if (!broadcastId) return new Response(JSON.stringify({ error: 'broadcastId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: broadcast } = await serviceSupabase.from('broadcasts').select('*, instances(*)').eq('id', broadcastId).eq('user_id', user.id).maybeSingle()
      if (!broadcast) return new Response(JSON.stringify({ error: 'Broadcast not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const inst = broadcast.instances
      const targetGroups = broadcast.target_groups || []
      await serviceSupabase.from('broadcasts').update({ status: 'sending', total_count: targetGroups.length, sent_count: 0 }).eq('id', broadcastId)

      let sentCount = 0
      for (const gJid of targetGroups) {
        try {
          if (broadcast.image_url) {
            await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${inst.name}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({ number: gJid, mediatype: 'image', media: broadcast.image_url, caption: broadcast.message }),
            })
          } else {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${inst.name}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({ number: gJid, text: broadcast.message }),
            })
          }
          sentCount++
          await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
          console.error('Failed to send to', gJid, e)
        }
      }

      const finalStatus = sentCount === targetGroups.length ? 'sent' : sentCount > 0 ? 'partial' : 'failed'
      await serviceSupabase.from('broadcasts').update({ status: finalStatus, sent_count: sentCount }).eq('id', broadcastId)
      return new Response(JSON.stringify({ success: true, sent: sentCount, total: targetGroups.length, status: finalStatus }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Evolution manager error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
