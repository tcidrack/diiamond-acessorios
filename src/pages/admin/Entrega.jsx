import { useEffect, useState } from 'react'
import CrudLista from '../../components/admin/CrudLista.jsx'
import { Campo, Erro, Titulo, useAviso } from '../../components/admin/UI.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, numeroParaCampo, parseBRL } from '../../lib/format.js'
import { PADRAO_ENTREGA, formatKm, mascaraCep, soDigitos, tabelaExemplo } from '../../lib/entrega.js'
import { lerCoordenadas } from '../../lib/cep.js'

const CAMPOS_NUM = Object.keys(PADRAO_ENTREGA)

export default function Entrega() {
  const [cfg, setCfg] = useState(null)
  const [origemSalva, setOrigemSalva] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    api.getConfig().then(paraTela).catch((e) => setErro(e.message))
  }, [])

  const paraTela = (c) => {
    setOrigemSalva(c.origem_lat != null)
    setCfg({
    ...c,
    entrega_modo: c.entrega_modo || 'bairros',
    origem_cep: mascaraCep(c.origem_cep || ''),
    ...Object.fromEntries(CAMPOS_NUM.map((k) => [k, numeroParaCampo(c[k] ?? PADRAO_ENTREGA[k])])),
    })
  }

  const mudarModo = async (modo) => {
    setErro('')
    if (modo === 'distancia' && !origemSalva) return setErro('Antes, configure e salve o ponto de saída (CEP de onde saem as entregas).')
    try {
      paraTela(await api.salvarConfig({ entrega_modo: modo }))
      setAviso(modo === 'distancia' ? 'Agora a entrega é calculada pela distância.' : 'Agora a entrega usa a lista de bairros.')
    } catch (e) {
      setErro(/entrega_modo|column/i.test(e.message) ? 'Rode a SQL 0009_entrega_distancia.sql no Supabase.' : e.message)
    }
  }

  if (!cfg) return <p className="text-sm text-magenta/40">{erro || 'Carregando…'}</p>

  return (
    <>
      {aviso}
      <Titulo>Entrega</Titulo>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {[
          ['distancia', 'Pela distância', 'A cliente informa o CEP e a taxa é calculada pela distância até a loja.'],
          ['bairros', 'Por bairro (lista)', 'A cliente escolhe o bairro numa lista com taxa fixa.'],
        ].map(([modo, titulo, detalhe]) => (
          <button
            key={modo}
            type="button"
            onClick={() => cfg.entrega_modo !== modo && mudarModo(modo)}
            className={`rounded-2xl border-2 p-4 text-left transition ${cfg.entrega_modo === modo ? 'border-magenta bg-blush/40' : 'border-blush bg-white hover:border-ouro'}`}
          >
            <span className="block font-semibold text-magenta">{titulo} {cfg.entrega_modo === modo && <span className="text-xs font-medium text-verde">· em uso</span>}</span>
            <span className="text-xs text-magenta/55">{detalhe}</span>
          </button>
        ))}
      </div>
      <Erro>{erro}</Erro>

      {cfg.entrega_modo === 'distancia' || !origemSalva ? (
        <Distancia cfg={cfg} setCfg={setCfg} paraTela={paraTela} setAviso={setAviso} />
      ) : null}

      {cfg.entrega_modo === 'bairros' && (
        <section className="mt-4">
          <h2 className="mb-1 font-display text-lg font-semibold text-magenta">Bairros e taxas</h2>
          <p className="mb-4 text-sm text-magenta/55">
            O cliente escolhe o bairro no checkout e a taxa entra no total. Taxa 0 = entrega grátis. Sem nenhum bairro ativo, a loja só oferece retirada.
            A ordem é a da lista no checkout: arraste pelos pontinhos ou digite a posição.
          </p>
          <CrudLista
            tabela="bairros_entrega"
            arrastavel
            rotuloNovo="Novo bairro"
            vazio="Nenhum bairro cadastrado ainda."
            colunas={[
              { chave: 'nome', rotulo: 'Bairro / região' },
              { chave: 'taxa', rotulo: 'Taxa (R$)', tipo: 'dinheiro', largura: 'w-28' },
              { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', largura: 'w-20' },
              { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle', largura: '' },
            ]}
            mostrar={(r) => ({ ...r, taxa: numeroParaCampo(r.taxa) })}
            novoRegistro={(l) => ({ nome: '', taxa: '', ordem: l.length + 1, ativo: true })}
            preparar={(r) => {
              if (!r.nome?.trim()) throw new Error('Informe o nome do bairro.')
              const taxa = parseBRL(r.taxa) ?? 0
              if (taxa < 0) throw new Error('Taxa inválida.')
              return { ...r, nome: r.nome.trim(), taxa, ordem: Number(r.ordem) || 0 }
            }}
          />
        </section>
      )}
    </>
  )
}

function Distancia({ cfg, setCfg, paraTela, setAviso }) {
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [origemAchada, setOrigemAchada] = useState('')
  const [simCep, setSimCep] = useState('')
  const [sim, setSim] = useState(null)
  const [colado, setColado] = useState('')

  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  const numeros = () => Object.fromEntries(CAMPOS_NUM.map((k) => [k, parseBRL(cfg[k])]))

  const buscarOrigem = async () => {
    setErro('')
    setOrigemAchada('')
    if (soDigitos(cfg.origem_cep).length !== 8) return setErro('Digite o CEP de onde saem as entregas.')
    setBuscando(true)
    try {
      const r = await api.cotarEntrega(cfg.origem_cep)
      if (r?.lat == null) throw new Error(r?.erro || 'Não foi possível achar a localização desse CEP. Tente de novo em instantes.')
      setCfg((c) => ({ ...c, origem_lat: r.lat, origem_lng: r.lng }))
      setOrigemAchada([r.logradouro, r.bairro, r.cidade].filter(Boolean).join(' · '))
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  // ajuste fino: coordenadas ou link do Google Maps colados pela dona
  const usarColado = (texto) => {
    setColado(texto)
    const p = lerCoordenadas(texto)
    if (!p) return
    setCfg((c) => ({ ...c, origem_lat: p.lat, origem_lng: p.lng }))
    setOrigemAchada('ponto colado do mapa')
  }

  const salvar = async () => {
    setErro('')
    const n = numeros()
    if (Object.values(n).some((v) => v === null || v < 0)) return setErro('Preencha todos os valores.')
    if (!(n.entrega_fator_rota >= 1 && n.entrega_fator_rota <= 3)) return setErro('O fator de rota fica entre 1 e 3 (1,3 é o normal).')
    if (cfg.origem_lat == null) return setErro('Toque em "Buscar" para achar o ponto de saída pelo CEP.')
    setSalvando(true)
    try {
      paraTela(await api.salvarConfig({
        ...n,
        origem_cep: soDigitos(cfg.origem_cep),
        origem_lat: Number(cfg.origem_lat),
        origem_lng: Number(cfg.origem_lng),
      }))
      setAviso('Valores da entrega salvos!')
    } catch (e) {
      setErro(/origem|entrega_|column/i.test(e.message) ? 'Rode a SQL 0009_entrega_distancia.sql no Supabase.' : e.message)
    } finally {
      setSalvando(false)
    }
  }

  const simular = async () => {
    setSim({ carregando: true })
    try {
      setSim(await api.cotarEntrega(simCep))
    } catch (e) {
      setSim({ ok: false, erro: e.message })
    }
  }

  const regras = numeros()
  const tabela = Object.values(regras).every((v) => v !== null) ? tabelaExemplo(regras) : []

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-magenta">Entrega pela distância</h2>

        <Campo rotulo="CEP de onde saem as entregas" ajuda="A distância é medida a partir daqui.">
          <div className="flex gap-2">
            <input inputMode="numeric" value={cfg.origem_cep} onChange={(e) => setCfg((c) => ({ ...c, origem_cep: mascaraCep(e.target.value) }))} className="campo tnum" placeholder="00000-000" />
            <button type="button" onClick={buscarOrigem} disabled={buscando} className="btn-claro shrink-0">{buscando ? 'Buscando…' : 'Buscar'}</button>
          </div>
        </Campo>
        {origemAchada && <p className="-mt-2 text-xs text-verde">Achado: {origemAchada}</p>}
        {cfg.origem_lat != null && (
          <p className="-mt-2 text-xs text-magenta/45">
            Ponto: {Number(cfg.origem_lat).toFixed(5)}, {Number(cfg.origem_lng).toFixed(5)} ·{' '}
            <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${cfg.origem_lat},${cfg.origem_lng}`}>ver no mapa</a>
          </p>
        )}
        <Campo rotulo="Ponto exato (opcional)" ajuda="Para mais precisão: no Google Maps, segure o dedo na porta da loja, copie os números que aparecem (ex.: -3.78292, -38.60191) ou o link, e cole aqui. Depois toque em Salvar.">
          <input value={colado} onChange={(e) => usarColado(e.target.value)} className="campo" placeholder="Cole as coordenadas ou o link do mapa" />
          {colado && !lerCoordenadas(colado) && <p className="mt-1 text-xs text-vermelho">Não reconheci as coordenadas nesse texto.</p>}
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Taxa mínima (R$)"><input inputMode="decimal" value={cfg.entrega_taxa_base} onChange={set('entrega_taxa_base')} className="campo tnum" /></Campo>
          <Campo rotulo="Taxa mínima até (km)"><input inputMode="decimal" value={cfg.entrega_raio_km} onChange={set('entrega_raio_km')} className="campo tnum" /></Campo>
          <Campo rotulo="Valor por km (R$)"><input inputMode="decimal" value={cfg.entrega_valor_km} onChange={set('entrega_valor_km')} className="campo tnum" /></Campo>
          <Campo rotulo="Entrega até (km)" ajuda="Acima disso: frete a combinar."><input inputMode="decimal" value={cfg.entrega_max_km} onChange={set('entrega_max_km')} className="campo tnum" /></Campo>
        </div>
        <Campo rotulo="Fator de rota" ajuda="A distância é medida em linha reta e multiplicada por este número para chegar perto do caminho pelas ruas. 1,3 é o normal; aumente se estiver cobrando pouco.">
          <input inputMode="decimal" value={cfg.entrega_fator_rota} onChange={set('entrega_fator_rota')} className="campo tnum w-28" />
        </Campo>
        <p className="rounded-2xl bg-cream px-4 py-3 text-xs text-magenta/70">
          Regra: até {cfg.entrega_raio_km} km = {formatBRL(regras.entrega_taxa_base || 0)}. Acima: {formatBRL(regras.entrega_taxa_base || 0)} + {formatBRL(regras.entrega_valor_km || 0)} por km
          (km arredondado para cima). Acima de {cfg.entrega_max_km} km o pedido é feito com o frete a combinar pelo WhatsApp.
        </p>
        <Erro>{erro}</Erro>
        <button type="button" onClick={salvar} disabled={salvando} className="btn-primario w-full">{salvando ? 'Salvando…' : 'Salvar valores da entrega'}</button>
      </section>

      <div className="space-y-4">
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold text-magenta">Testar um CEP</h2>
          <p className="text-xs text-magenta/55">Usa os valores já salvos. Mostra exatamente o que a cliente vai ver.</p>
          <div className="flex gap-2">
            <input inputMode="numeric" value={simCep} onChange={(e) => setSimCep(mascaraCep(e.target.value))} className="campo tnum" placeholder="CEP da cliente" />
            <button type="button" onClick={simular} disabled={soDigitos(simCep).length !== 8 || sim?.carregando} className="btn-claro shrink-0">Calcular</button>
          </div>
          {sim && (
            <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-magenta">
              {sim.carregando ? 'Calculando…'
                : !sim.ok ? <span className="text-vermelho">{sim.erro}</span>
                  : <>
                      {[sim.logradouro, sim.bairro].filter(Boolean).join(' · ')}
                      {sim.lat != null && <> · <a className="text-xs underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${sim.lat},${sim.lng}`}>ver no mapa</a>
                        {sim.fonte === 'bairro' && <span className="text-xs text-magenta/55"> (centro do bairro)</span>}</>}
                      <br />
                      {sim.km == null
                        ? <>Localização do CEP não encontrada → <strong>frete a combinar</strong></>
                        : <><strong>{formatKm(sim.km)}</strong> → {sim.a_combinar ? <strong>frete a combinar</strong> : <strong>{formatBRL(sim.taxa)}</strong>}</>}
                    </>}
            </p>
          )}
        </section>

        {tabela.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-2 font-display text-lg font-semibold text-magenta">Quanto a cliente paga</h2>
            <table className="w-full text-sm">
              <tbody>
                {tabela.map((l, i) => (
                  <tr key={i} className="border-b border-blush/60 last:border-0">
                    <td className="py-1.5 text-magenta/70">{l.km == null ? `Mais de ${cfg.entrega_max_km} km` : `até ${l.km} km`}</td>
                    <td className="tnum py-1.5 text-right font-semibold text-magenta">{l.a_combinar ? 'A combinar' : formatBRL(l.taxa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}
