import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVOLUTION_API_URL = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '')
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

Deno.serve(async () => {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find scheduled broadcasts that are due
    const now = new Date().toISOString()
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*, instances(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(10)

    if (error) {
      console.error('Error fetching scheduled broadcasts:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    if (!broadcasts || broadcasts.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }))
    }

    console.log(`Processing ${broadcasts.length} scheduled broadcast(s)`)

    let totalProcessed = 0

    for (const broadcast of broadcasts) {
      const instance = broadcast.instances
      if (!instance) continue

      const targetGroups = broadcast.target_groups || []
      await supabase.from('broadcasts').update({ status: 'sending', total_count: targetGroups.length, sent_count: 0 }).eq('id', broadcast.id)

      let sentCount = 0

      for (const groupJid of targetGroups) {
        try {
          if (broadcast.image_url) {
            await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instance.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({
                number: groupJid,
                mediatype: 'image',
                media: broadcast.image_url,
                caption: broadcast.message,
              }),
            })
          } else {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({ number: groupJid, text: broadcast.message }),
            })
          }
          sentCount++
          await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
          console.error('Failed to send to', groupJid, e)
        }
      }

      const finalStatus = sentCount === targetGroups.length ? 'sent' : sentCount > 0 ? 'partial' : 'failed'
      await supabase.from('broadcasts').update({ status: finalStatus, sent_count: sentCount }).eq('id', broadcast.id)
      totalProcessed++
      console.log(`Broadcast ${broadcast.id}: ${finalStatus} (${sentCount}/${targetGroups.length})`)
    }

    return new Response(JSON.stringify({ processed: totalProcessed }))
  } catch (err) {
    console.error('Broadcast scheduler error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})