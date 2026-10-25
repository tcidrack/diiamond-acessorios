// Simulador do painel: a dona testa o bot sem mandar nada para o Instagram.
import { corsHeaders, json } from '../_shared/cors.ts'
import { clienteServico, exigirAdmin } from '../_shared/supabase.ts'
import { decidirResposta, type MensagemConversa } from '../_shared/agente.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!(await exigirAdmin(req))) return json({ erro: 'Acesso negado.' }, 401)

  const { mensagens } = await req.json().catch(() => ({ mensagens: [] }))
  if (!Array.isArray(mensagens) || !mensagens.length) return json({ erro: 'Envie ao menos uma mensagem.' }, 400)

  const historico: MensagemConversa[] = mensagens
    .filter((m: any) => ['cliente', 'bot', 'dona'].includes(m?.autor))
    .map((m: any) => ({
      autor: m.autor,
      texto: String(m.texto || '').slice(0, 2000),
      // áudio gravado no simulador (base64); só o que ainda não foi transcrito
      audio: m.audio?.data ? { data: String(m.audio.data), mimeType: String(m.audio.mimeType || 'audio/webm') } : null,
    }))

  return json(await decidirResposta(clienteServico(), historico))
})
