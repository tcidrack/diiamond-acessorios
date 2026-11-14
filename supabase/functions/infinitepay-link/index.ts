// Cartão online: cria (ou reaproveita) o link da InfinitePay do pedido e confere o pagamento
// quando a cliente volta do checkout. Só age com código + token do link do pedido.
import { corsHeaders, json } from '../_shared/cors.ts'
import { clienteServico } from '../_shared/supabase.ts'
import { confirmarPagamento, criarLink, handleDaLoja } from '../_shared/infinitepay.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const corpo = await req.json().catch(() => ({}))
  const { acao = 'criar', codigo, token } = corpo
  if (!codigo || !/^[0-9a-f-]{36}$/i.test(String(token || ''))) return json({ erro: 'Pedido não encontrado.' }, 404)

  const db = clienteServico()
  const { data: pedido } = await db.from('pedidos').select('*').eq('codigo', codigo).eq('token', token).maybeSingle()
  if (!pedido || pedido.forma_pagamento !== 'cartao_online') return json({ erro: 'Pedido não encontrado.' }, 404)

  try {
    if (acao === 'verificar') {
      const pago = await confirmarPagamento(db, pedido, {
        slug: corpo.slug, transaction_nsu: corpo.transaction_nsu, receipt_url: corpo.receipt_url,
      })
      return json({ pago })
    }

    if (pedido.pago_em) return json({ pago: true })
    if (pedido.status === 'cancelado') return json({ erro: 'Este pedido foi cancelado.' }, 400)
    if (pedido.pagamento_link) return json({ url: pedido.pagamento_link })

    const handle = await handleDaLoja(db)
    if (!handle) return json({ erro: 'Pagamento com cartão indisponível no momento. Fale com a loja.' }, 400)

    const { data: cfg } = await db.from('config_loja').select('url_loja').eq('id', 1).single()
    const base = String(cfg?.url_loja || req.headers.get('origin') || '').replace(/\/+$/, '')
    if (!/^https?:\/\//.test(base)) return json({ erro: 'Endereço da loja não configurado.' }, 400)

    const url = await criarLink(handle, pedido, `${base}/pedido/${pedido.codigo}?t=${pedido.token}`)
    await db.from('pedidos').update({ pagamento_link: url }).eq('id', pedido.id)
    return json({ url })
  } catch (e) {
    console.error(e)
    return json({ erro: 'Não foi possível falar com a InfinitePay. Tente de novo em instantes.' }, 502)
  }
})
