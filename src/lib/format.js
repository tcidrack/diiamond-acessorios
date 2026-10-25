const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(valor) {
  return brl.format(Number(valor) || 0)
}

/** "12,90" / "12.90" / "R$ 1.234,90" -> 12.9 */
export function parseBRL(texto) {
  if (typeof texto === 'number') return texto
  if (!texto) return null
  const limpo = String(texto).replace(/[^\d,.-]/g, '')
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

export function numeroParaCampo(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  return Number(valor).toFixed(2).replace('.', ',')
}

export function formatData(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function formatTelefone(tel) {
  const d = String(tel || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel || ''
}

/** Link wa.me com +55 automático (igual ao catalogo-online). */
export function linkWhatsApp(numero, texto = '') {
  let d = String(numero || '').replace(/\D/g, '')
  if (d && !d.startsWith('55')) d = '55' + d
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

export function slugify(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Arredonda para a terminação ,90 — o padrão de preço que a loja já usa. */
export function arredondar90(valor) {
  if (!Number.isFinite(valor) || valor <= 0) return 0
  const base = Math.floor(valor)
  return valor <= base + 0.9 ? base + 0.9 : base + 1.9
}
