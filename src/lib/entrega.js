import { formatBRL } from './format.js'

/**
 * Taxa de entrega por distância — mesma regra da função calcular_entrega do banco
 * (supabase/migrations/0009_entrega_distancia.sql). Aqui serve para o modo demonstração e
 * para a tabela de exemplo do painel; na loja de verdade quem decide a taxa é o banco.
 */

export const PADRAO_ENTREGA = {
  entrega_raio_km: 2,
  entrega_taxa_base: 3,
  entrega_valor_km: 1,
  entrega_max_km: 10,
  entrega_fator_rota: 1.3,
  entrega_gratis_km: 0, // entrega grátis até X km (0 = desligado)
}

const num = (v, padrao) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? padrao : Number(v))

export function regrasEntrega(cfg = {}) {
  return Object.fromEntries(Object.entries(PADRAO_ENTREGA).map(([k, v]) => [k, num(cfg[k], v)]))
}

/** Taxa para uma distância já medida (km de ida, já com o fator de rota). */
export function taxaPorKm(km, cfg) {
  const r = regrasEntrega(cfg)
  if (km > r.entrega_max_km) return { km, taxa: 0, a_combinar: true }
  if (r.entrega_gratis_km > 0 && km <= r.entrega_gratis_km) return { km, taxa: 0, a_combinar: false, gratis_km: true }
  const taxa = km <= r.entrega_raio_km ? r.entrega_taxa_base : r.entrega_taxa_base + r.entrega_valor_km * Math.ceil(km)
  return { km, taxa: Math.round(taxa * 100) / 100, a_combinar: false }
}

/** Distância em linha reta (km) entre dois pontos. */
export function haversine(lat1, lng1, lat2, lng2) {
  const rad = (g) => (g * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

/**
 * Km pelas ruas só vale se for plausível: entre a linha reta e 2,5× ela (+0,5 km de folga).
 * Mesma regra do banco (0011_entrega_rota.sql).
 */
export function kmRotaValido(reta, kmRota) {
  const k = Number(kmRota)
  return kmRota != null && kmRota !== '' && Number.isFinite(k) && k >= reta * 0.95 && k <= reta * 2.5 + 0.5
}

export function calcularFrete(cfg, lat, lng, kmRota = null) {
  if (cfg?.origem_lat == null || cfg?.origem_lng == null) return { ok: false, erro: 'A loja ainda não configurou o ponto de saída das entregas.' }
  // sem a localização do CEP: frete a combinar (igual ao banco)
  if (lat == null || lng == null) return { ok: true, km: null, taxa: 0, a_combinar: true, sem_local: true }
  const r = regrasEntrega(cfg)
  const reta = haversine(Number(cfg.origem_lat), Number(cfg.origem_lng), lat, lng)
  const pelaRua = kmRotaValido(reta, kmRota)
  const km = Math.round((pelaRua ? Number(kmRota) : reta * r.entrega_fator_rota) * 10) / 10
  return { ok: true, ...taxaPorKm(km, cfg), pela_rua: pelaRua }
}

/** Valor mínimo (subtotal com desconto) para entrega grátis, ou 0 se desligado. */
export const minimoEntregaGratis = (cfg) => Math.max(0, Number(cfg?.entrega_gratis_acima) || 0)

/** Entrega grátis a partir de um valor (mesma regra do banco, 0012). `base` = subtotal - desconto. */
export function ganhaEntregaGratis(base, cfg) {
  const min = minimoEntregaGratis(cfg)
  return min > 0 && base >= min
}

/** Linhas do horário de entrega (texto livre, uma por linha). */
export const linhasHorarioEntrega = (cfg) => String(cfg?.horario_entrega || '').split('\n').map((l) => l.trim()).filter(Boolean)

/** Linhas da tabela de exemplo do painel (1 km até o limite). */
export function tabelaExemplo(cfg) {
  const r = regrasEntrega(cfg)
  const linhas = []
  if (r.entrega_gratis_km > 0 && r.entrega_gratis_km < r.entrega_max_km && !Number.isInteger(r.entrega_gratis_km)) {
    linhas.push(taxaPorKm(r.entrega_gratis_km, cfg))
  }
  for (let km = 1; km <= Math.min(Math.ceil(r.entrega_max_km), 30); km++) linhas.push(taxaPorKm(km, cfg))
  linhas.push({ ...taxaPorKm(r.entrega_max_km + 0.1, cfg), km: null })
  return linhas
}

export const formatKm = (km) => `${String(Number(km).toFixed(1)).replace('.', ',')} km`

export const soDigitos = (v) => String(v || '').replace(/\D/g, '')
export const mascaraCep = (v) => soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')

/** "Granja Portugal · 3,4 km" (o km só aparece em pedido pela distância e só para a dona: `comKm`). */
export function detalheEntrega(pedido, { comKm = true } = {}) {
  const km = comKm && pedido.distancia_km != null ? (pedido.entrega_aproximada ? `≈ ${formatKm(pedido.distancia_km)} (aproximado)` : formatKm(pedido.distancia_km)) : null
  return [pedido.bairro_nome, km].filter(Boolean).join(' · ')
}

/** Valor da entrega para mostrar: "R$ 7,00", "Grátis" ou "A combinar". */
export function valorEntrega(pedido) {
  if (pedido.entrega_a_combinar) return 'A combinar'
  return Number(pedido.taxa_entrega) > 0 ? formatBRL(pedido.taxa_entrega) : 'Grátis'
}
