// Webhook da InfinitePay: avisa quando um link foi pago.
// Publicar SEM verificação de JWT (a InfinitePay não manda token do Supabase):
//   supabase functions deploy infinitepay-webhook --no-verify-jwt
// O aviso não tem assinatura, então o pagamento é sempre conferido no payment_check antes de confirmar.
import { clienteServico } from '../_shared/supabase.ts'
import { confirmarPagamento } from '../_shared/infinitepay.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const corpo = await req.json().catch(() => null)
  if (!corpo?.order_nsu) return new Response('ignorado')

  const db = clienteServico()
  const { data: pedido } = await db.from('pedidos').select('*').eq('codigo', String(corpo.order_nsu)).maybeSingle()
  if (!pedido) return new Response('ignorado')

  try {
    const pago = await confirmarPagamento(db, pedido, {
      slug: corpo.invoice_slug, transaction_nsu: corpo.transaction_nsu, receipt_url: corpo.receipt_url,
    })
    if (!pago) console.warn('Webhook InfinitePay sem pagamento confirmado', corpo.order_nsu)
    return new Response('ok')
  } catch (e) {
    console.error(e)
    // 400 faz a InfinitePay reenviar o aviso mais tarde
    return new Response('erro', { status: 400 })
  }
})
