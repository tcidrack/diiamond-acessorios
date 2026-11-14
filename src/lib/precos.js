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
  cartao_online: { rotulo: 'Cartão online', detalhe: 'Crédito em até 12x, pago aqui no site' },
  cartao: { rotulo: 'Cartão na maquininha', detalhe: 'Crédito ou débito na maquininha, na entrega ou retirada' },
}

export const STATUS_PEDIDO = {
  novo: { rotulo: 'Novo', cor: 'bg-blush text-magenta' },
  aguardando_pagamento: { rotulo: 'Aguardando pagamento', cor: 'bg-ambar-bg text-ambar' },
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

// ---------------- cores do mesmo modelo ----------------

/** Cores prontas para a bolinha. `metal` ganha um brilho. */
export const CORES_PRONTAS = [
  { nome: 'Prata', hex: '#c4c7cc', metal: true },
  { nome: 'Dourado', hex: '#d4af37', metal: true },
  { nome: 'Rosé', hex: '#dba596', metal: true },
  { nome: 'Pérola', hex: '#f1e9da' },
  { nome: 'Branco', hex: '#ffffff' },
  { nome: 'Preto', hex: '#222222' },
  { nome: 'Vermelho', hex: '#d32f2f' },
  { nome: 'Rosa', hex: '#f06292' },
  { nome: 'Lilás', hex: '#b39ddb' },
  { nome: 'Roxo', hex: '#7b1fa2' },
  { nome: 'Azul', hex: '#1e63c6' },
  { nome: 'Azul claro', hex: '#7cc4f0' },
  { nome: 'Verde', hex: '#2e7d32' },
  { nome: 'Verde água', hex: '#4fc3b5' },
  { nome: 'Amarelo', hex: '#f5c518' },
  { nome: 'Laranja', hex: '#f57c00' },
  { nome: 'Nude', hex: '#e3c4a8' },
  { nome: 'Marrom', hex: '#795548' },
]

const METAIS = new Set(CORES_PRONTAS.filter((c) => c.metal).map((c) => c.hex.toLowerCase()))

/** Fundo da bolinha: a cor escolhida (metais com brilho) ou, sem cor, a primeira foto do produto. */
export function fundoBolinha(produto) {
  const hex = String(produto.cor_hex || '').toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(hex)) {
    return METAIS.has(hex)
      ? { background: `linear-gradient(135deg, rgba(255,255,255,.75) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,.12) 100%), ${hex}` }
      : { background: hex }
  }
  const foto = produto.imagens?.[0]?.url
  return foto ? { backgroundImage: `url("${foto}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#e5e1dc' }
}

/** Todas as cores do modelo (inclui o próprio produto), na ordem da vitrine. Vazio se não tem grupo. */
export function variantesDe(produto, produtos) {
  if (!produto?.grupo_cor) return []
  const lista = produtos.filter((p) => p.grupo_cor === produto.grupo_cor && p.ativo !== false)
  if (!lista.some((p) => p.id === produto.id)) lista.push(produto)
  return lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.id - b.id)
}
