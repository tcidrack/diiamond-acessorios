// Puxa conversas antigas do Direct e transforma as respostas da dona em exemplos
// (chegam DESLIGADOS: a dona escolhe no painel quais representam o jeito dela).
import { corsHeaders, json } from '../_shared/cors.ts'
import { clienteServico, exigirAdmin } from '../_shared/supabase.ts'
import { listarConversas } from '../_shared/instagram.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!(await exigirAdmin(req))) return json({ erro: 'Acesso negado.' }, 401)

  const meuId = Deno.env.get('IG_USER_ID')
  if (!meuId) return json({ erro: 'Configure o secret IG_USER_ID (id da conta da loja).' }, 500)

  const db = clienteServico()
  let conversas
  try {
    conversas = await listarConversas(40)
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 502)
  }

  const { data: existentes } = await db.from('ia_exemplos').select('cliente, resposta')
  const jaTem = new Set((existentes || []).map((e) => `${e.cliente}§${e.resposta}`))
  const novos: { cliente: string; resposta: string; origem: string; ativo: boolean }[] = []

  for (const c of conversas) {
    // a API devolve da mais nova para a mais antiga
    const msgs = [...(c.messages?.data || [])].reverse().filter((m) => m.message?.trim())
    let doCliente: string[] = []
    let daDona: string[] = []
    const fechar = () => {
      if (doCliente.length && daDona.length) {
        const par = { cliente: doCliente.join('\n').slice(0, 600), resposta: daDona.join('\n').slice(0, 800) }
        if (!jaTem.has(`${par.cliente}§${par.resposta}`)) {
          jaTem.add(`${par.cliente}§${par.resposta}`)
          novos.push({ ...par, origem: 'importado', ativo: false })
        }
      }
      doCliente = []
      daDona = []
    }
    for (const m of msgs) {
      if (m.from.id === meuId) daDona.push(m.message!)
      else {
        if (daDona.length) fechar()
        doCliente.push(m.message!)
      }
    }
    fechar()
  }

  if (novos.length) {
    const { error } = await db.from('ia_exemplos').insert(novos.slice(0, 300))
    if (error) return json({ erro: error.message }, 500)
  }
  return json({ importados: Math.min(novos.length, 300), conversas: conversas.length })
})
