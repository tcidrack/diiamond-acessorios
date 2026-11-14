import { geocodificarGeoapify } from './geoapify.js'

/**
 * Busca o endereço e a localização de um CEP direto do navegador.
 *
 * 1. Endereço: AwesomeAPI (traz rua, bairro e um ponto) → reservas BrasilAPI/ViaCEP (só endereço).
 * 2. Ponto conferido pela Geoapify (ver geoapify.js): a AwesomeAPI às vezes erra feio em rua
 *    numerada ("Rua 339" existe em vários conjuntos).
 * Sem ponto conferido, a entrega fica "a combinar" e a venda não trava.
 */

const cache = new Map()

async function json(url, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    return r.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Endereço básico do CEP (sem conferir o ponto). */
async function enderecoDoCep(c) {
  const a = await json(`https://cep.awesomeapi.com.br/json/${c}`)
  if (a?.cep) {
    const lat = Number(a.lat)
    const lng = Number(a.lng)
    const temPonto = Number.isFinite(lat) && Number.isFinite(lng) && lat && lng
    return { cep: c, logradouro: a.address || '', bairro: a.district || '', cidade: a.city || '', uf: a.state || '', lat: temPonto ? lat : null, lng: temPonto ? lng : null }
  }
  // reservas só para o endereço (as coordenadas delas são do centro da cidade, não servem)
  const b = await json(`https://brasilapi.com.br/api/cep/v1/${c}`)
  if (b?.cep) return { cep: c, logradouro: b.street || '', bairro: b.neighborhood || '', cidade: b.city || '', uf: b.state || '', lat: null, lng: null }
  const v = await json(`https://viacep.com.br/ws/${c}/json/`)
  if (v && !v.erro) return { cep: c, logradouro: v.logradouro || '', bairro: v.bairro || '', cidade: v.localidade || '', uf: v.uf || '', lat: null, lng: null }
  return null
}

/** Ponto conferido pela Geoapify; sem conferência, sem ponto (= frete a combinar). */
export async function conferirPonto(end) {
  return (await geocodificarGeoapify(end)) || { lat: null, lng: null, fonte: null }
}

/** `{ cep, logradouro, bairro, cidade, uf, lat, lng, fonte }` (lat/lng null se não achou) ou null se o CEP não existe. */
export async function buscarCep(cep) {
  const c = String(cep || '').replace(/\D/g, '')
  if (c.length !== 8) return null
  if (cache.has(c)) return cache.get(c)
  const end = await enderecoDoCep(c)
  if (!end) return null
  const r = { ...end, ...(await conferirPonto(end)) }
  cache.set(c, r)
  return r
}

/**
 * Lê coordenadas coladas pela dona: "-3.78292, -38.60191" ou links do Google Maps
 * (…/@-3.78,-38.60,17z, ?q=-3.78,-38.60, !3d-3.78!4d-38.60). Devolve { lat, lng } ou null.
 */
export function lerCoordenadas(texto) {
  let s = String(texto || '')
  try { s = decodeURIComponent(s) } catch { /* texto com % solto: usa como está */ }
  s = s.replace(/\s+/g, ' ')
  const num = String.raw`(-?\d{1,3}\.\d+)`
  const padroes = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`@${num},\s?${num}`),
    new RegExp(String.raw`[?&](?:q|query|ll|destination)=${num},\s?${num}`),
    new RegExp(String.raw`^\s*${num}\s*[,;]\s*${num}\s*$`),
  ]
  for (const re of padroes) {
    const m = s.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng)) return { lat, lng }
  }
  return null
}
