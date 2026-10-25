/** Preço que o cliente paga hoje (promoção só vale se for menor que o preço cheio). */
export function precoFinal(produto) {
  const cheio = Number(produto.preco) || 0
  const promo = produto.preco_promocional
  return promo !== null && promo !== undefined && promo !== '' && Number(promo) < cheio ? Number(promo) : cheio
}

export function emPromocao(produto) {
  return precoFinal(produto) < (Number(produto.preco) || 0)
}

export function percentualDesconto(produto) {
  const cheio = Number(produto.preco) || 0
  if (!emPromocao(produto) || cheio <= 0) return 0
  return Math.round((1 - precoFinal(produto) / cheio) * 100)
}

export function esgotado(produto) {
  return produto.estoque !== null && produto.estoque !== undefined && produto.estoque <= 0
}

export const FORMAS_PAGAMENTO = {
  pix: { rotulo: 'Pix', detalhe: 'QR Code ou copia e cola, direto no app do banco' },
  dinheiro: { rotulo: 'Dinheiro', detalhe: 'Pague na entrega ou retirada' },
  cartao: { rotulo: 'Cartão', detalhe: 'Crédito ou débito na maquininha, na entrega ou retirada' },
}

export const STATUS_PEDIDO = {
  novo: { rotulo: 'Novo', cor: 'bg-blush text-magenta' },
  aguardando_pagamento: { rotulo: 'Aguardando Pix', cor: 'bg-ambar-bg text-ambar' },
  pagamento_enviado: { rotulo: 'Pix informado', cor: 'bg-ouro-palido text-[#7a5f00] ring-1 ring-ouro/40' },
  confirmado: { rotulo: 'Pagamento confirmado', cor: 'bg-verde-bg text-verde' },
  separando: { rotulo: 'Separando', cor: 'bg-cream-deep text-magenta-soft' },
  pronto: { rotulo: 'Pronto p/ retirada', cor: 'bg-verde-bg text-verde' },
  saiu_entrega: { rotulo: 'Saiu para entrega', cor: 'bg-verde-bg text-verde' },
  concluido: { rotulo: 'Concluído', cor: 'bg-gray-100 text-gray-600' },
  cancelado: { rotulo: 'Cancelado', cor: 'bg-vermelho-bg text-vermelho' },
}

/** Próximos passos sugeridos no painel, conforme entrega ou retirada. */
export function proximosStatus(pedido) {
  const final = pedido.tipo_entrega === 'entrega' ? 'saiu_entrega' : 'pronto'
  const fluxo = {
    novo: ['separando'],
    aguardando_pagamento: ['confirmado'],
    pagamento_enviado: ['confirmado'],
    confirmado: ['separando'],
    separando: [final],
    pronto: ['concluido'],
    saiu_entrega: ['concluido'],
    concluido: [],
    cancelado: [],
  }
  return fluxo[pedido.status] || []
}
