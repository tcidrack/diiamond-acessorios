// Busca o endereço e as coordenadas de um CEP e devolve quanto custa entregar nele.
// As coordenadas ficam guardadas na tabela ceps (só este servidor grava), e é dela que o
// criar_pedido tira a distância: o navegador nunca manda coordenada nem taxa.
// Fontes gratuitas, sem chave: AwesomeAPI (tem lat/lng) e, de reserva, BrasilAPI.
import { corsHeaders, json } from '../_shared/cors.ts'
import { clienteServico } from '../_shared/supabase.ts'

const VALIDADE_DIAS = 90

type Cep = { cep: string; lat: number; lng: number; logradouro: string; bairro: string; cidade: string; uf: string }

async function buscar(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  return await r.json().catch(() => null)
}

async function consultarCep(cep: string): Promise<Cep | null> {
  const a = await buscar(`https://cep.awesomeapi.com.br/json/${cep}`).catch(() => null)
  const lat = Number(a?.lat)
  const lng = Number(a?.lng)
  if (a && Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    return { cep, lat, lng, logradouro: a.address || '', bairro: a.district || '', cidade: a.city || '', uf: a.state || '' }
  }
  const b = await buscar(`https://brasilapi.com.br/api/cep/v2/${cep}`).catch(() => null)
  const bl = Number(b?.location?.coordinates?.latitude)
  const bg = Number(b?.location?.coordinates?.longitude)
  if (b && Number.isFinite(bl) && Number.isFinite(bg) && bl && bg) {
    return { cep, lat: bl, lng: bg, logradouro: b.street || '', bairro: b.neighborhood || '', cidade: b.city || '', uf: b.state || '' }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const corpo = await req.json().catch(() => ({}))
  const cep = String(corpo?.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return json({ ok: false, erro: 'Informe um CEP válido.' })

  const db = clienteServico()
  try {
    const { data: guardado } = await db.from('ceps').select('*').eq('cep', cep).maybeSingle()
    const vencido = !guardado || Date.now() - new Date(guardado.atualizado_em).getTime() > VALIDADE_DIAS * 864e5
    let dados: Cep | null = guardado
    if (vencido) {
      const novo = await consultarCep(cep)
      if (novo) {
        const { error } = await db.from('ceps').upsert({ ...novo, atualizado_em: new Date().toISOString() })
        if (error) throw error
        dados = novo
      }
    }
    if (!dados) return json({ ok: false, erro: 'Não encontramos esse CEP. Confira e tente de novo.' })

    const { data: frete, error } = await db.rpc('calcular_entrega', { p_cep: cep })
    if (error) throw error
    return json({
      ...(frete || {}),
      cep,
      lat: dados.lat,
      lng: dados.lng,
      logradouro: dados.logradouro,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf,
      // sem ponto de saída configurado ainda, devolve só o endereço (o painel usa para achar a origem)
      ok: frete?.ok ?? false,
      erro: frete?.ok ? undefined : frete?.erro,
    })
  } catch (e) {
    console.error(e)
    return json({ ok: false, erro: 'Não foi possível consultar o CEP agora. Tente de novo em instantes.' }, 502)
  }
})
