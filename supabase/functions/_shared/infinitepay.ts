// Checkout Integrado da InfinitePay (https://www.infinitepay.io/checkout-documentacao).
// O webhook deles não tem assinatura: pagamento só é dado como pago depois de conferido no payment_check.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://api.checkout.infinitepay.io'

async function post(caminho: string, corpo: unknown) {
  const r = await fetch(`${API}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`InfinitePay ${caminho} respondeu ${r.status}: ${JSON.stringify(dados).slice(0, 300)}`)
  return dados
}

export async function handleDaLoja(db: SupabaseClient): Promise<string> {
  const { data } = await db.from('config_loja').select('infinitepay_handle').eq('id', 1).single()
  return String(data?.infinitepay_handle || '').trim().replace(/^\$/, '')
}

/** Cria o link de pagamento do pedido (valor total já com cupom e frete). */
export async function criarLink(handle: string, pedido: any, redirectUrl: string): Promise<string> {
  const dados = await post('/links', {
    handle,
    order_nsu: pedido.codigo,
    items: [{ quantity: 1, price: Math.round(Number(pedido.total) * 100), description: `Pedido ${pedido.codigo}` }],
    redirect_url: redirectUrl,
    webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/infinitepay-webhook`,
    customer: { name: pedido.cliente_nome, phone_number: `+55${String(pedido.cliente_telefone).replace(/^55(?=\d{10,11}$)/, '')}` },
  })
  const url = dados.url || dados.link || dados.checkout_url
  if (!url) throw new Error(`InfinitePay não devolveu o link: ${JSON.stringify(dados).slice(0, 300)}`)
  return url
}

/**
 * Confere na InfinitePay se o pedido foi pago e, se foi, marca como confirmado.
 * Idempotente: pedido já pago retorna true sem mexer em nada.
 */
export async function confirmarPagamento(
  db: SupabaseClient,
  pedido: any,
  { slug, transaction_nsu, receipt_url }: { slug?: string; transaction_nsu?: string; receipt_url?: string },
): Promise<boolean> {
  if (pedido.pago_em) return true
  if (pedido.forma_pagamento !== 'cartao_online' || pedido.status === 'cancelado') return false
  if (!slug || !transaction_nsu) return false

  const handle = await handleDaLoja(db)
  if (!handle) return false
  const r = await post('/payment_check', { handle, order_nsu: pedido.codigo, transaction_nsu, slug })
  if (!r.success || !r.paid) return false
  if (Number(r.paid_amount ?? r.amount ?? 0) < Math.round(Number(pedido.total) * 100)) return false

  const { error } = await db.from('pedidos').update({
    status: ['novo', 'aguardando_pagamento', 'pagamento_enviado'].includes(pedido.status) ? 'confirmado' : pedido.status,
    pago_em: new Date().toISOString(),
    pagamento_nsu: String(transaction_nsu),
    pagamento_slug: String(slug),
    pagamento_parcelas: Number(r.installments) || 1,
    pagamento_recibo: receipt_url && /^https:\/\//.test(receipt_url) ? receipt_url : null,
  }).eq('id', pedido.id).is('pago_em', null)
  if (error) throw error
  return true
}
