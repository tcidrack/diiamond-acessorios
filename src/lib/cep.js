import { haversine } from './entrega.js'

/**
 * Busca o endereço e a localização de um CEP direto do navegador.
 *
 * 1. Endereço: AwesomeAPI (traz rua, bairro e um ponto) → reservas BrasilAPI/ViaCEP (só endereço).
 * 2. Ponto conferido no OpenStreetMap (Photon): a AwesomeAPI às vezes erra feio em rua numerada
 *    ("Rua 339" existe em vários conjuntos). Ordem de confiança:
 *    rua achada no bairro certo → ponto da AwesomeAPI se estiver perto do bairro → centro do bairro.
 * Sem ponto nenhum, a entrega fica "a combinar" e a venda não trava.
 */

const PHOTON = 'https://photon.komoot.io/api/'
const TOLERANCIA_KM = 2.5 // ponto da AwesomeAPI aceito se estiver até aqui do centro do bairro
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

async function photon(q) {
  const r = await json(`${PHOTON}?${new URLSearchParams({ q, limit: '8' })}`, 5000)
  return (r?.features || []).map((f) => ({ ...f.properties, lng: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] }))
}

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

/** Escolhe o ponto mais confiável para o endereço (ver ordem no topo). */
export async function conferirPonto(end) {
  const cidade = normalizar(end.cidade)
  const bairro = normalizar(end.bairro)
  const rua = normalizar(end.logradouro)
  const naCidade = (f) => !cidade || normalizar(f.city) === cidade
  const temPonto = (f) => Number.isFinite(f.lat) && Number.isFinite(f.lng)

  const [ruas, bairros] = await Promise.all([
    rua ? photon(`${end.logradouro} ${end.bairro} ${end.cidade}`) : [],
    bairro ? photon(`${end.bairro} ${end.cidade}`) : [],
  ])

  const daRua = ruas.find((f) => temPonto(f) && naCidade(f) && f.type === 'street' && normalizar(f.name) === rua
    && (normalizar(f.district) === bairro || String(f.postcode || '').replace(/\D/g, '') === end.cep))
  if (daRua) return { lat: daRua.lat, lng: daRua.lng, fonte: 'rua' }

  const doBairro = bairros.find((f) => temPonto(f) && naCidade(f) && f.type !== 'street' && normalizar(f.name) === bairro)
  if (end.lat != null && (!doBairro || haversine(end.lat, end.lng, doBairro.lat, doBairro.lng) <= TOLERANCIA_KM)) {
    return { lat: end.lat, lng: end.lng, fonte: 'cep' }
  }
  if (doBairro) return { lat: doBairro.lat, lng: doBairro.lng, fonte: 'bairro' }
  return { lat: null, lng: null, fonte: null }
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
