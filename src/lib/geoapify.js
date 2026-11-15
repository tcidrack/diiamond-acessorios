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

const TIPO_RUA = /^(rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|al\.?|estrada|rodovia)$/i
const SEPARADORES_FIM = /[\s,;/\-–—]+$/
// nome da rua sem o tipo ("Rua", "Av."…), para comparar
const semPrefixo = (s) => norm(s).replace(/^(rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|al\.?) /, '')

/**
 * Separa rua e número da casa SEM apagar números do nome da rua. Aceita qualquer separação:
 * "Rua das Flores, 123", "Rua das Flores 123", "Rua das Flores - 123", "Rua das Flores nº 123",
 * "Rua das Flores 123 casa B" (o que vem depois do número é ignorado), "Rua 10 45" → "Rua 10" + 45,
 * "Rua 7 de Setembro 100" → "Rua 7 de Setembro" + 100; "Rua 10" sozinha é só a rua.
 */
export function separarRuaNumero(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim()
  const limpar = (s) => s.replace(SEPARADORES_FIM, '').replace(/\s+n[º°o]?\.?$/i, '').replace(SEPARADORES_FIM, '').trim()
  // com vírgula: o número é o primeiro depois da primeira vírgula ("Rua 339, 67")
  const virgula = t.indexOf(',')
  if (virgula > 0) {
    const rua = limpar(t.slice(0, virgula))
    const numero = (t.slice(virgula + 1).match(/\d{1,5}/) || [''])[0]
    if (rua && !TIPO_RUA.test(rua)) return { rua, numero }
  }
  // sem vírgula: o primeiro número cuja parte da frente já é um nome de rua (não só "Rua")
  for (const m of t.matchAll(/(?:\s*[;/\-–—]\s*|\s+)(?:n[º°o]?\.?\s*)?(\d{1,5})(?!\d)/gi)) {
    const rua = limpar(t.slice(0, m.index))
    if (rua && !TIPO_RUA.test(rua) && /[a-zà-ú]/i.test(rua)) return { rua, numero: m[1] }
  }
  return { rua: limpar(t), numero: '' }
}

/**
 * Endereço digitado (ex.: "Rua José Abílio, 804") → `{ lat, lng, rotulo, achouNumero, bairro, cep }` ou null.
 * Só aceita a rua digitada (a Geoapify às vezes devolve o mesmo número em outra rua) e procura num raio
 * em volta de `perto` (ponto do CEP ou da loja). `bairro` desempata ruas de mesmo nome ("Rua 101" existe em
 * vários conjuntos), mas não reprova: o nome do bairro varia entre o mapa e o que a cliente digita.
 */
export async function buscarEndereco(texto, { cidade = '', uf = '', perto = null, raioKm = 8, bairro = '' } = {}) {
  if (!GEOAPIFY_KEY) return null
  const { rua: ruaTexto, numero } = separarRuaNumero(texto)
  const rua = semPrefixo(ruaTexto)
  if (!rua) return null
  const raio = perto?.lat != null
    ? { filter: `circle:${perto.lng},${perto.lat},${Math.round(raioKm * 1000)}`, bias: `proximity:${perto.lng},${perto.lat}` }
    : { filter: 'countrycode:br' }
  const base = { ...raio, limit: '10' }
  const [a, b] = await Promise.all([
    chamar('search', { ...base, street: ruaTexto, housenumber: numero, city: cidade, state: uf }),
    chamar('search', { ...base, text: [ruaTexto, numero, bairro, cidade, uf].filter(Boolean).join(', ') }),
  ])
  // mesma rua = nome igual (sem "Rua"/"Av."), não "contém": "Rua 339" não pode casar com "Rua 1339"
  const mesmaRua = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && semPrefixo(x.street || x.name) === rua
  let todos = [...a, ...b].filter(mesmaRua)
  // número desconhecido no mapa: procura só a rua
  if (!todos.length && numero) {
    todos = (await chamar('search', { ...base, street: ruaTexto, city: cidade, state: uf })).filter(mesmaRua)
  }
  // número "achado" com pouca confiança = a Geoapify inventou (ex.: nº 99999): não serve
  const confiavel = (x) => (x.rank?.confidence ?? 1) >= 0.9
  const temNumero = (x) => !!numero && String(x.housenumber || '') === numero && confiavel(x)
  const b0 = norm(bairro)
  const doBairro = (x) => !!b0 && [x.suburb, x.district, x.quarter, x.neighbourhood].some((v) => !!norm(v) && (norm(v) === b0 || norm(v).includes(b0) || b0.includes(norm(v))))
  const dist = (x) => (perto?.lat != null ? (x.lat - perto.lat) ** 2 + (x.lon - perto.lng) ** 2 : 0)
  // prioridade: mesmo bairro, depois número exato, depois o mais perto
  const nota = (x) => (doBairro(x) ? 2 : 0) + (temNumero(x) ? 1 : 0)
  const r = [...todos].sort((x, y) => nota(y) - nota(x) || dist(x) - dist(y))[0]
  if (!r) return null
  const achouNumero = temNumero(r)
  return {
    lat: r.lat,
    lng: r.lon,
    achouNumero,
    noBairro: doBairro(r),
    bairro: r.suburb || r.district || r.quarter || r.neighbourhood || '',
    cep: digitos(r.postcode).length === 8 ? digitos(r.postcode) : '',
    rotulo: [achouNumero ? `${r.street}, ${r.housenumber}` : r.street || r.name, r.suburb || r.district, r.city].filter(Boolean).join(' · '),
  }
}

/** Ponto do bairro (sem achar a rua): `{ lat, lng, rotulo, bairro, cep }` ou null. */
export async function buscarBairro(bairro, { cidade = '', uf = '', perto = null, raioKm = 8 } = {}) {
  const b0 = norm(bairro)
  if (!GEOAPIFY_KEY || b0.length < 3) return null
  const raio = perto?.lat != null ? { filter: `circle:${perto.lng},${perto.lat},${Math.round(raioKm * 1000)}`, bias: `proximity:${perto.lng},${perto.lat}` } : { filter: 'countrycode:br' }
  const lista = await chamar('search', { ...raio, limit: '10', text: [bairro, cidade, uf].filter(Boolean).join(', ') })
  const nomes = (x) => [x.suburb, x.district, x.quarter, x.neighbourhood, x.name].map(norm).filter(Boolean)
  const ok = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && nomes(x).some((n) => n === b0 || n.startsWith(b0 + ' '))
  const r = lista.find((x) => ok(x) && ['suburb', 'district', 'neighbourhood', 'quarter'].includes(x.result_type)) || lista.find(ok)
  if (!r) return null
  const nome = r.suburb || r.district || r.name || bairro
  return { lat: r.lat, lng: r.lon, bairro: nome, cep: '', achouNumero: false, rotulo: [nome, r.city].filter(Boolean).join(' · ') }
}

/**
 * Bairros onde existe a rua digitada (ex.: "Rua Luminosa" → Granja Portugal, Granja Lisboa), do mais perto
 * de `perto` (a loja) para o mais longe. Para a cliente escolher o bairro dela.
 */
export async function bairrosDaRua(texto, { cidade = '', uf = '', perto = null, raioKm = 8, max = 6 } = {}) {
  const { rua: ruaTexto } = separarRuaNumero(texto)
  const rua = semPrefixo(ruaTexto)
  if (!GEOAPIFY_KEY || rua.length < 2) return []
  const raio = perto?.lat != null
    ? { filter: `circle:${perto.lng},${perto.lat},${Math.round(raioKm * 1000)}`, bias: `proximity:${perto.lng},${perto.lat}` }
    : { filter: 'countrycode:br' }
  const lista = await chamar('search', { ...raio, limit: '20', street: ruaTexto, city: cidade, state: uf })
  const dist = (x) => (perto?.lat != null ? (x.lat - perto.lat) ** 2 + (x.lon - perto.lng) ** 2 : 0)
  const nomes = []
  for (const x of lista.filter((x) => Number.isFinite(x.lat) && semPrefixo(x.street || x.name) === rua).sort((a, b) => dist(a) - dist(b))) {
    const nome = String(x.suburb || x.district || x.quarter || x.neighbourhood || '').trim()
    if (nome && !nomes.some((n) => norm(n) === norm(nome))) nomes.push(nome)
    if (nomes.length >= max) break
  }
  return nomes
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
