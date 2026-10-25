import { formatBRL } from './format.js'
import { FORMAS_PAGAMENTO } from './precos.js'

/** Texto que o cliente manda para o WhatsApp da loja ao finalizar. */
export function mensagemPedidoWhatsApp(pedido, itens, link) {
  const linhas = [
    `*Novo pedido ${pedido.codigo}* 💎`,
    '',
    ...itens.map((i) => `• ${i.quantidade}x ${i.nome} — ${formatBRL(i.subtotal)}`),
    '',
    `Subtotal: ${formatBRL(pedido.subtotal)}`,
  ]
  if (Number(pedido.desconto) > 0) linhas.push(`Desconto${pedido.cupom_codigo ? ` (${pedido.cupom_codigo})` : ''}: -${formatBRL(pedido.desconto)}`)
  if (pedido.tipo_entrega === 'entrega') linhas.push(`Entrega (${pedido.bairro_nome}): ${formatBRL(pedido.taxa_entrega)}`)
  linhas.push(`*Total: ${formatBRL(pedido.total)}*`, '')
  linhas.push(`Nome: ${pedido.cliente_nome}`)
  if (pedido.tipo_entrega === 'entrega') {
    linhas.push(`Entrega: ${pedido.endereco}${pedido.complemento ? `, ${pedido.complemento}` : ''} — ${pedido.bairro_nome}`)
    if (pedido.referencia) linhas.push(`Referência: ${pedido.referencia}`)
  } else {
    linhas.push('Vou retirar na loja')
  }
  let pagamento = FORMAS_PAGAMENTO[pedido.forma_pagamento]?.rotulo || pedido.forma_pagamento
  if (pedido.forma_pagamento === 'dinheiro' && pedido.troco_para) pagamento += ` (troco para ${formatBRL(pedido.troco_para)})`
  if (pedido.forma_pagamento === 'cartao') pagamento += ' na maquininha'
  if (pedido.forma_pagamento === 'pix') pagamento += pedido.comprovante_enviado_em ? ' — já paguei ✅' : ' (vou pagar pelo QR Code)'
  linhas.push(`Pagamento: ${pagamento}`)
  if (pedido.observacao) linhas.push(`Obs.: ${pedido.observacao}`)
  if (link) linhas.push('', `Acompanhar: ${link}`)
  return linhas.join('\n')
}

/** Texto que a dona manda ao cliente quando muda o status no painel. */
export function mensagemStatusCliente(pedido, link) {
  const nome = pedido.cliente_nome.split(' ')[0]
  const textos = {
    confirmado: `Oi ${nome}! Recebemos seu pagamento do pedido ${pedido.codigo} 💖 Já vamos separar tudo!`,
    separando: `Oi ${nome}! Seu pedido ${pedido.codigo} está sendo separado com carinho ✨`,
    pronto: `Oi ${nome}! Seu pedido ${pedido.codigo} está pronto para retirada 💎`,
    saiu_entrega: `Oi ${nome}! Seu pedido ${pedido.codigo} saiu para entrega 🛵💖`,
    concluido: `Oi ${nome}! Obrigada pela compra 💖 Esperamos que ame suas peças! Se puder, marca a gente no Instagram ✨`,
    cancelado: `Oi ${nome}! Seu pedido ${pedido.codigo} foi cancelado. Qualquer dúvida é só chamar 💖`,
  }
  const base = textos[pedido.status] || `Oi ${nome}! Sobre seu pedido ${pedido.codigo}:`
  return link && pedido.status !== 'concluido' ? `${base}\nAcompanhe: ${link}` : base
}
