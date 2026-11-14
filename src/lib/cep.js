/**
 * Busca o endereço e a localização de um CEP direto do navegador.
 * AwesomeAPI devolve rua, bairro e lat/lng (no servidor do Supabase ela bloqueia por cota; no
 * celular da cliente funciona). Se falhar, BrasilAPI/ViaCEP devolvem só o endereço: sem localização,
 * a entrega fica "a combinar" e a venda não trava.
 */

const cache = new Map()

async function json(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    return r.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** `{ cep, logradouro, bairro, cidade, uf, lat, lng }` (lat/lng null se não achou) ou null se o CEP não existe. */
export async function buscarCep(cep) {
  const c = String(cep || '').replace(/\D/g, '')
  if (c.length !== 8) return null
  if (cache.has(c)) return cache.get(c)

  let r = null
  const a = await json(`https://cep.awesomeapi.com.br/json/${c}`)
  const lat = Number(a?.lat)
  const lng = Number(a?.lng)
  if (a?.cep && Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    r = { cep: c, logradouro: a.address || '', bairro: a.district || '', cidade: a.city || '', uf: a.state || '', lat, lng }
  } else {
    // reservas só para o endereço (as coordenadas delas são do centro da cidade, não servem)
    const b = await json(`https://brasilapi.com.br/api/cep/v1/${c}`)
    if (b?.cep) {
      r = { cep: c, logradouro: b.street || '', bairro: b.neighborhood || '', cidade: b.city || '', uf: b.state || '', lat: null, lng: null }
    } else {
      const v = await json(`https://viacep.com.br/ws/${c}/json/`)
      if (v && !v.erro) r = { cep: c, logradouro: v.logradouro || '', bairro: v.bairro || '', cidade: v.localidade || '', uf: v.uf || '', lat: null, lng: null }
    }
  }
  if (r) cache.set(c, r)
  return r
}
