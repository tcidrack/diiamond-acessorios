/**
 * Localização de endereço pela Geoapify (mapas do OpenStreetMap; conta grátis, 3.000 consultas/dia).
 * Chave de navegador (pode ser travada no site em Geoapify → API keys → Allowed origins).
 *
 * Ordem (cada passo confere bairro/CEP, porque "Rua 101" existe em vários conjuntos):
 *  1. rua + CEP (busca estruturada) → a rua certa no bairro/CEP certo;
 *  2. só o CEP → ponto do CEP, se cair no bairro certo;
 *  3. ponto da AwesomeAPI conferido de trás pra frente (o CEP do lugar tem que ser da mesma região).
 * Se nada confere: null → frete a combinar.
 */

export const GEOAPIFY_KEY = import.meta.env?.VITE_GEOAPIFY_KEY || '584efffac40c4681979905bdc11971f8'
const BASE = 'https://api.geoapify.com/v1/geocode'

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const digitos = (s) => String(s || '').replace(/\D/g, '')

async function chamar(caminho, params) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const q = new URLSearchParams({ ...params, format: 'json', apiKey: GEOAPIFY_KEY })
    const r = await fetch(`${BASE}/${caminho}?${q}`, { signal: ctrl.signal })
    return r.ok ? (await r.json()).results || [] : []
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}

/** `{ lat, lng, fonte }` conferido, ou null. `end` = { cep, logradouro, bairro, cidade, uf, lat, lng } */
export async function geocodificarGeoapify(end) {
  if (!GEOAPIFY_KEY) return null
  const bairro = norm(end.bairro)
  const cidade = norm(end.cidade)
  const mesmoBairro = (x) => !!bairro && [x.suburb, x.district, x.quarter, x.neighbourhood].some((b) => norm(b) === bairro)
  const mesmoCep = (x) => digitos(x.postcode) === end.cep
  const valido = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && (!cidade || norm(x.city) === cidade)
  const local = { city: end.cidade, state: end.uf, filter: 'countrycode:br', limit: '5' }

  // 1. rua + CEP
  if (end.logradouro) {
    const rs = await chamar('search', { ...local, street: end.logradouro, postcode: end.cep })
    const r = rs.find((x) => valido(x) && ['street', 'building'].includes(x.result_type)
      && norm(x.street || x.name) === norm(end.logradouro) && (mesmoBairro(x) || mesmoCep(x)))
    if (r) return { lat: r.lat, lng: r.lon, fonte: 'rua' }
  }

  // 2. só o CEP
  const cs = await chamar('search', { ...local, postcode: end.cep })
  const c = cs.find((x) => valido(x) && x.result_type !== 'city' && mesmoCep(x) && (!bairro || mesmoBairro(x)))
  if (c) return { lat: c.lat, lng: c.lon, fonte: 'cep' }

  // 3. ponto da AwesomeAPI, conferido pelo lugar onde ele cai
  if (end.lat != null && end.lng != null) {
    const [v] = await chamar('reverse', { lat: String(end.lat), lon: String(end.lng) })
    if (v && (mesmoBairro(v) || digitos(v.postcode).slice(0, 4) === end.cep.slice(0, 4))) {
      return { lat: end.lat, lng: end.lng, fonte: 'cep' }
    }
  }

  // 4. reserva: um ponto dentro do bairro (erro de no máximo o tamanho do bairro)
  if (bairro) {
    const bs = await chamar('search', { ...local, name: end.bairro })
    const b = bs.find((x) => valido(x) && x.result_type !== 'city' && mesmoBairro(x))
    if (b) return { lat: b.lat, lng: b.lon, fonte: 'bairro' }
  }
  return null
}

/**
 * Endereço digitado pela dona (ex.: "Rua José Abílio, 804") → `{ lat, lng, rotulo, achouNumero }` ou null.
 * Só aceita a rua digitada (a Geoapify às vezes devolve o mesmo número em outra rua) e procura
 * perto de `perto` (ponto do CEP), se houver.
 */
export async function buscarEndereco(texto, { cidade = '', uf = '', perto = null } = {}) {
  if (!GEOAPIFY_KEY) return null
  const [ruaTexto, resto = ''] = String(texto || '').split(',').map((s) => s.trim())
  const numero = (resto.match(/\d+/) || String(texto).match(/\b\d{1,5}\b/) || [''])[0]
  const rua = norm(ruaTexto.replace(/\d+/g, ''))
  if (!rua) return null
  const raio = perto?.lat != null ? { filter: `circle:${perto.lng},${perto.lat},8000`, bias: `proximity:${perto.lng},${perto.lat}` } : { filter: 'countrycode:br' }
  const base = { ...raio, limit: '10' }
  const [a, b] = await Promise.all([
    chamar('search', { ...base, street: ruaTexto.replace(/\d+/g, '').trim(), housenumber: numero, city: cidade, state: uf }),
    chamar('search', { ...base, text: [texto, cidade, uf].filter(Boolean).join(', ') }),
  ])
  const mesmaRua = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && norm(x.street || x.name).includes(rua.replace(/^(rua|avenida|av\.?|travessa|tv\.?) /, ''))
  let todos = [...a, ...b].filter(mesmaRua)
  // número desconhecido no mapa: procura só a rua (a dona arrasta o pino até a porta)
  if (!todos.length && numero) {
    todos = (await chamar('search', { ...base, street: ruaTexto.replace(/\d+/g, '').trim(), city: cidade, state: uf })).filter(mesmaRua)
  }
  const comNumero = numero && todos.find((x) => String(x.housenumber || '') === numero)
  const r = comNumero || todos[0]
  if (!r) return null
  return {
    lat: r.lat,
    lng: r.lon,
    achouNumero: !!comNumero,
    rotulo: [comNumero ? `${r.street}, ${r.housenumber}` : r.street || r.name, r.suburb, r.city].filter(Boolean).join(' · '),
  }
}

/** Distância de moto pelas ruas, em km (1 casa), ou null se não deu. */
export async function rotaKm(origem, destino) {
  if (!GEOAPIFY_KEY || origem?.lat == null || destino?.lat == null) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const q = new URLSearchParams({
      waypoints: `${origem.lat},${origem.lng}|${destino.lat},${destino.lng}`,
      mode: 'motorcycle', format: 'json', apiKey: GEOAPIFY_KEY,
    })
    const r = await fetch(`https://api.geoapify.com/v1/routing?${q}`, { signal: ctrl.signal })
    const m = r.ok ? (await r.json()).results?.[0]?.distance : null
    return Number.isFinite(m) ? Math.round(m / 100) / 10 : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
