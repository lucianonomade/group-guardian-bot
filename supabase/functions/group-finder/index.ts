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

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const evoHeaders = { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY }
    const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    // SEARCH: Find WhatsApp group links on the web based on a theme
    if (action === 'search' && req.method === 'POST') {
      const { theme, instanceId } = await req.json()
      if (!theme || typeof theme !== 'string' || theme.trim().length < 2) {
        return new Response(JSON.stringify({ error: 'Tema inválido (mínimo 2 caracteres)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (!instanceId) {
        return new Response(JSON.stringify({ error: 'instanceId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Create task record
      const { data: task, error: taskError } = await supabase.from('group_finder_tasks').insert({
        user_id: user.id,
        instance_id: instanceId,
        theme: theme.trim(),
        status: 'searching',
      }).select().single()

      if (taskError) {
        return new Response(JSON.stringify({ error: taskError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Search for WhatsApp group links using Google
      const searchQuery = `site:chat.whatsapp.com "${theme.trim()}" grupo whatsapp`
      const links: string[] = []

      try {
        // Use a simple search approach - fetch Google search results
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20`
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        })
        const html = await searchRes.text()

        // Extract chat.whatsapp.com links from results
        const linkRegex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/g
        const matches = html.match(linkRegex) || []
        const uniqueLinks = [...new Set(matches)]
        links.push(...uniqueLinks.slice(0, 20))
      } catch (e) {
        console.error('Search error:', e)
      }

      // Update task with found links
      await serviceSupabase.from('group_finder_tasks').update({
        invite_links: links,
        groups_found: links.length,
        status: links.length > 0 ? 'found' : 'no_results',
      }).eq('id', task.id)

      return new Response(JSON.stringify({
        success: true,
        taskId: task.id,
        linksFound: links.length,
        links,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // VALIDATE: Check if invite links are valid and get group info
    if (action === 'validate' && req.method === 'POST') {
      const { links, instanceName, taskId } = await req.json()
      if (!links || !Array.isArray(links) || links.length === 0) {
        return new Response(JSON.stringify({ error: 'Links array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (taskId) {
        await serviceSupabase.from('group_finder_tasks').update({ status: 'validating' }).eq('id', taskId)
      }

      const results: any[] = []

      for (const link of links) {
        // Extract invite code from link
        const codeMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
        if (!codeMatch) {
          results.push({ link, valid: false, error: 'Link inválido' })
          continue
        }
        const inviteCode = codeMatch[1]

        try {
          // Get group info via invite code
          const infoRes = await fetch(`${EVOLUTION_API_URL}/group/inviteInfo/${instanceName}`, {
            method: 'POST',
            headers: evoHeaders,
            body: JSON.stringify({ inviteCode }),
          })
          
          if (!infoRes.ok) {
            const errText = await infoRes.text()
            console.error('inviteInfo failed:', infoRes.status, errText)
            results.push({ link, inviteCode, valid: false, error: 'Grupo não encontrado ou link expirado' })
            continue
          }

          const info = await infoRes.json()
          results.push({
            link,
            inviteCode,
            valid: true,
            groupName: info.subject || info.name || 'Sem nome',
            groupJid: info.id || info.jid || null,
            size: info.size || info.participants?.length || 0,
            description: info.desc || info.description || null,
          })
        } catch (e) {
          console.error('Validate error for', link, e)
          results.push({ link, inviteCode, valid: false, error: 'Erro ao validar' })
        }

        // Rate limit between requests
        await new Promise(r => setTimeout(r, 1000))
      }

      if (taskId) {
        const validCount = results.filter(r => r.valid).length
        await serviceSupabase.from('group_finder_tasks').update({
          results,
          groups_found: validCount,
          status: 'validated',
        }).eq('id', taskId)
      }

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // JOIN: Accept invite and join groups
    if (action === 'join' && req.method === 'POST') {
      const { inviteCodes, instanceName, taskId } = await req.json()
      if (!inviteCodes || !Array.isArray(inviteCodes) || inviteCodes.length === 0) {
        return new Response(JSON.stringify({ error: 'inviteCodes array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (taskId) {
        await serviceSupabase.from('group_finder_tasks').update({ status: 'joining' }).eq('id', taskId)
      }

      const joinResults: any[] = []
      let joinedCount = 0

      for (const code of inviteCodes) {
        try {
          const joinRes = await fetch(`${EVOLUTION_API_URL}/group/acceptInviteCode/${instanceName}`, {
            method: 'POST',
            headers: evoHeaders,
            body: JSON.stringify({ inviteCode: code }),
          })
          
          const joinData = await joinRes.json()
          
          if (joinRes.ok && !joinData.error) {
            joinedCount++
            joinResults.push({ inviteCode: code, joined: true, groupJid: joinData.id || joinData.jid || null })
          } else {
            joinResults.push({ inviteCode: code, joined: false, error: joinData.message || joinData.error || 'Falha ao entrar' })
          }
        } catch (e) {
          console.error('Join error for code', code, e)
          joinResults.push({ inviteCode: code, joined: false, error: 'Erro de conexão' })
        }

        // Rate limit between joins
        await new Promise(r => setTimeout(r, 2000))
      }

      if (taskId) {
        await serviceSupabase.from('group_finder_tasks').update({
          groups_joined: joinedCount,
          status: 'completed',
          results: joinResults,
        }).eq('id', taskId)
      }

      return new Response(JSON.stringify({ success: true, joined: joinedCount, total: inviteCodes.length, results: joinResults }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Group finder error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})