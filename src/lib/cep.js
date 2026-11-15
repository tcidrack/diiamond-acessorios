import { buscarBairro, buscarEndereco, geocodificarGeoapify } from './geoapify.js'
import { haversine } from './entrega.js'

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
 * Ponto da entrega: o do CEP, refinado pelo NÚMERO da casa quando dá (rua comprida: o ponto do CEP pode ficar
 * longe do número). Só aceita o número achado na mesma rua e a até 3 km do ponto do CEP.
 */
export async function localDaEntrega(cep, numero) {
  const end = await buscarCep(cep)
  if (!end) return null
  const n = String(numero || '').replace(/\D/g, '')
  if (!n || end.lat == null || !end.logradouro) return end
  const achado = await buscarEndereco(`${end.logradouro}, ${n}`, { cidade: end.cidade, uf: end.uf, perto: end })
  if (achado?.achouNumero && haversine(end.lat, end.lng, achado.lat, achado.lng) <= 3) {
    return { ...end, lat: achado.lat, lng: achado.lng, fonte: 'numero', numero: n }
  }
  return { ...end, numero: n }
}

/**
 * Checkout sem CEP: rua e número + bairro digitados → ponto no mapa, procurado em volta da loja.
 * `{ lat, lng, rotulo, achouNumero, aproximado }`; sem achar nada, lat/lng null (frete a combinar).
 * (O CEP do mapa não é usado: o OpenStreetMap erra muito o CEP.)
 */
export async function localPorEndereco({ endereco, bairro }, cfg) {
  const loja = { lat: Number(cfg?.origem_lat), lng: Number(cfg?.origem_lng) }
  const origem = cfg?.origem_cep ? await buscarCep(cfg.origem_cep).catch(() => null) : null
  const raioKm = Math.min(40, Math.max(8, Number(cfg?.entrega_max_km) || 10) + 3)
  const opcoes = { cidade: origem?.cidade || '', uf: origem?.uf || '', perto: loja, raioKm, bairro }
  const [rua, doBairro] = await Promise.all([buscarEndereco(endereco, opcoes), buscarBairro(bairro, opcoes)])
  const nada = { lat: null, lng: null, rotulo: '', achouNumero: false, aproximado: true }
  if (rua) {
    // rua de mesmo nome em outro lugar ("Rua 101" de outro conjunto): longe do bairro digitado → usa o bairro
    const longeDoBairro = !rua.noBairro && doBairro && haversine(rua.lat, rua.lng, doBairro.lat, doBairro.lng) > 3
    if (!longeDoBairro) return { lat: rua.lat, lng: rua.lng, rotulo: rua.rotulo, achouNumero: rua.achouNumero, aproximado: !rua.achouNumero }
  }
  if (doBairro) return { ...nada, lat: doBairro.lat, lng: doBairro.lng, rotulo: doBairro.rotulo }
  return nada
}
