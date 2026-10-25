// A dona responde uma conversa do Direct pelo painel.
import { corsHeaders, json } from '../_shared/cors.ts'
import { clienteServico, exigirAdmin } from '../_shared/supabase.ts'
import { enviarTexto } from '../_shared/instagram.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!(await exigirAdmin(req))) return json({ erro: 'Acesso negado.' }, 401)

  const { conversa_id, texto } = await req.json().catch(() => ({}))
  const mensagem = String(texto || '').trim()
  if (!conversa_id || !mensagem) return json({ erro: 'Conversa e texto são obrigatórios.' }, 400)

  const db = clienteServico()
  const { data: conversa } = await db.from('ig_conversas').select('*').eq('id', conversa_id).single()
  if (!conversa) return json({ erro: 'Conversa não encontrada.' }, 404)
  const { data: ia } = await db.from('ia_config').select('pausa_horas').eq('id', 1).single()

  try {
    const mid = await enviarTexto(conversa.ig_user_id, mensagem)
    await db.from('ig_mensagens').insert({ conversa_id, ig_mid: mid, autor: 'dona', texto: mensagem })
    // a dona assumiu: o bot fica quieto nessa conversa por um tempo
    await db.from('ig_conversas').update({
      modo: 'dona',
      precisa_dona: false,
      pausado_ate: new Date(Date.now() + (ia?.pausa_horas ?? 12) * 3600_000).toISOString(),
      ultima_mensagem: mensagem,
      ultima_em: new Date().toISOString(),
    }).eq('id', conversa_id)
    return json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ erro: /24|window|janela/i.test(msg) ? 'Passou de 24h desde a última mensagem da cliente: responda pelo app do Instagram.' : msg }, 502)
  }
})
