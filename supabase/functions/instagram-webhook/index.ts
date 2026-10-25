// Webhook do Instagram: recebe cada DM, guarda no banco e (se ligado) responde com a IA.
// Publicar SEM verificação de JWT (a Meta não manda token do Supabase):
//   supabase functions deploy instagram-webhook --no-verify-jwt
import { clienteServico } from '../_shared/supabase.ts'
import { assinaturaValida, enviarTexto, perfil } from '../_shared/instagram.ts'
import { decidirResposta, type MensagemConversa } from '../_shared/agente.ts'

const ESPERA_MS = 6000 // cliente costuma mandar 2-3 mensagens seguidas: espera e responde tudo junto

const TEXTO_AUDIO = '🎤 áudio' // trocado pela transcrição depois que a IA ouve

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

function dentroDoHorario(inicio: string | null, fim: string | null): boolean {
  if (!inicio || !fim) return true
  const agora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false }).slice(0, 5)
  const [i, f] = [inicio.slice(0, 5), fim.slice(0, 5)]
  return i <= f ? agora >= i && agora < f : agora >= i || agora < f // aceita faixa que vira a meia-noite
}

async function conversaDe(db: ReturnType<typeof clienteServico>, igUserId: string) {
  const { data: existente } = await db.from('ig_conversas').select('*').eq('ig_user_id', igUserId).maybeSingle()
  if (existente) return existente
  const p = await perfil(igUserId)
  const { data } = await db.from('ig_conversas')
    .upsert({ ig_user_id: igUserId, nome: p.name || null, username: p.username || null }, { onConflict: 'ig_user_id' })
    .select().single()
  return data
}

async function processarEvento(evento: any) {
  const db = clienteServico()
  const meuId = Deno.env.get('IG_USER_ID')
  const msg = evento.message
  if (!msg || msg.is_deleted || msg.is_unsupported) return

  const ehEco = !!msg.is_echo || evento.sender?.id === meuId
  const cliente = ehEco ? evento.recipient?.id : evento.sender?.id
  if (!cliente || cliente === meuId) return

  const conversa = await conversaDe(db, cliente)
  if (!conversa) return
  const anexos = (msg.attachments || []).map((a: any) => ({ type: a.type, url: a.payload?.url || null }))
  const temAudio = anexos.some((a: any) => a.type === 'audio')
  const texto = msg.text || (temAudio ? TEXTO_AUDIO : anexos.length ? `[${anexos.map((a: any) => a.type).join(', ')}]` : '')
  const agora = new Date().toISOString()

  if (ehEco) {
    // eco de mensagem que o próprio bot mandou: já está salva com esse mid.
    // O eco pode chegar antes de o bot terminar de salvar, por isso a espera.
    await espera(4000)
    const { data: jaSalva } = await db.from('ig_mensagens').select('id').eq('ig_mid', msg.mid).maybeSingle()
    if (jaSalva) return
    // senão a dona respondeu pelo app do Instagram: registra e pausa o bot nessa conversa
    const { data: ia } = await db.from('ia_config').select('pausa_horas').eq('id', 1).single()
    await db.from('ig_mensagens').insert({ conversa_id: conversa.id, ig_mid: msg.mid, autor: 'dona', texto })
    await db.from('ig_conversas').update({
      modo: 'dona', precisa_dona: false, ultima_mensagem: texto, ultima_em: agora,
      pausado_ate: new Date(Date.now() + (ia?.pausa_horas ?? 12) * 3600_000).toISOString(),
    }).eq('id', conversa.id)
    return
  }

  // mensagem da cliente (o índice único de ig_mid ignora reentregas da Meta)
  const { data: inserida, error } = await db.from('ig_mensagens')
    .insert({
      conversa_id: conversa.id, ig_mid: msg.mid, autor: 'cliente', texto,
      meta: msg.reply_to || anexos.length ? { reply_to: msg.reply_to, anexos } : null,
    })
    .select('id').single()
  if (error || !inserida) return
  await db.from('ig_conversas').update({ ultima_mensagem: texto, ultima_em: agora }).eq('id', conversa.id)

  const { data: ia } = await db.from('ia_config').select('*').eq('id', 1).single()
  if (!ia?.ativo || !dentroDoHorario(ia.horario_inicio, ia.horario_fim)) return

  // modo teste: só responde os @ liberados (a mensagem dos outros fica salva no painel)
  if (ia.modo_teste) {
    const liberados = (ia.usernames_teste || []).map((u: string) => u.trim().replace(/^@/, '').toLowerCase())
    let username = conversa.username
    if (!username) {
      username = (await perfil(cliente)).username || null
      if (username) await db.from('ig_conversas').update({ username }).eq('id', conversa.id)
    }
    if (!username || !liberados.includes(username.toLowerCase())) return
  }

  // a dona assumiu: só volta para o bot depois da pausa
  if (conversa.modo === 'dona') {
    if (conversa.pausado_ate && new Date(conversa.pausado_ate) > new Date()) return
    if (conversa.precisa_dona) return // ainda esperando a dona responder
    await db.from('ig_conversas').update({ modo: 'bot', pausado_ate: null }).eq('id', conversa.id)
  }

  await espera(ESPERA_MS)
  // chegou mensagem mais nova? a execução dela responde por todas
  const { data: maisNova } = await db.from('ig_mensagens').select('id')
    .eq('conversa_id', conversa.id).eq('autor', 'cliente').gt('id', inserida.id).limit(1)
  if (maisNova?.length) return
  // a dona pode ter respondido durante a espera
  const { data: atual } = await db.from('ig_conversas').select('modo').eq('id', conversa.id).single()
  if (atual?.modo !== 'bot') return

  const { data: linhas } = await db.from('ig_mensagens').select('id, autor, texto, meta')
    .eq('conversa_id', conversa.id).order('created_at', { ascending: false }).limit(24)
  const historico = (linhas || []).reverse()
  // áudio ainda não transcrito vai como arquivo para o Gemini; os já transcritos vão como texto
  const conversaIA: MensagemConversa[] = historico.map((m: any) => {
    const audio = m.autor === 'cliente' && m.texto === TEXTO_AUDIO ? m.meta?.anexos?.find((a: any) => a.type === 'audio' && a.url) : null
    return { autor: m.autor, texto: m.texto, audio: audio ? { url: audio.url } : null }
  })
  const decisao = await decidirResposta(db, conversaIA)

  // guarda o que a cliente falou no áudio: o painel mostra e as próximas respostas usam o texto
  if (decisao.transcricao) {
    const ultimoAudio = [...historico].reverse().find((m: any) => m.autor === 'cliente' && m.texto === TEXTO_AUDIO)
    if (ultimoAudio) await db.from('ig_mensagens').update({ texto: `🎤 ${decisao.transcricao}` }).eq('id', ultimoAudio.id)
  }

  try {
    const mid = await enviarTexto(cliente, decisao.resposta)
    await db.from('ig_mensagens').insert({
      conversa_id: conversa.id, ig_mid: mid, autor: 'bot', texto: decisao.resposta,
      meta: { acao: decisao.acao, motivo: decisao.motivo, origem: decisao.origem },
    })
  } catch (e) {
    console.error('Falha ao enviar resposta:', e)
    decisao.acao = 'passar_para_dona'
    decisao.motivo = `Não consegui enviar a resposta: ${e instanceof Error ? e.message : e}`
  }

  await db.from('ig_conversas').update({
    ultima_mensagem: decisao.resposta,
    ultima_em: new Date().toISOString(),
    ...(decisao.acao === 'passar_para_dona' ? { modo: 'dona', precisa_dona: true, pausado_ate: null } : {}),
  }).eq('id', conversa.id)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // verificação do webhook no painel da Meta
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === Deno.env.get('IG_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge')) : new Response('forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const corpo = await req.text()
  if (!(await assinaturaValida(corpo, req.headers.get('x-hub-signature-256')))) {
    return new Response('assinatura inválida', { status: 401 })
  }

  const dados = JSON.parse(corpo)
  const eventos = (dados.entry || []).flatMap((e: any) => e.messaging || [])
  // responde 200 na hora (a Meta reenvia se demorar) e processa em segundo plano
  const trabalho = Promise.all(eventos.map((ev: any) => processarEvento(ev).catch((e) => console.error('evento:', e))))
  // @ts-ignore EdgeRuntime existe no Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabalho)
  else await trabalho
  return new Response('EVENT_RECEIVED')
})
