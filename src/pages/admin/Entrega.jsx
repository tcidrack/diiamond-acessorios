import { useEffect, useState } from 'react'
import CrudLista from '../../components/admin/CrudLista.jsx'
import { Campo, Erro, Titulo, useAviso } from '../../components/admin/UI.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, numeroParaCampo, parseBRL } from '../../lib/format.js'
import { PADRAO_ENTREGA, formatKm, mascaraCep, soDigitos, tabelaExemplo } from '../../lib/entrega.js'
import SugestoesBairro, { useBairrosSugeridos } from '../../components/SugestoesBairro.jsx'
import { buscarEndereco } from '../../lib/geoapify.js'
import MapaPino from '../../components/admin/MapaPino.jsx'

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
    entrega_gratis_acima: Number(c.entrega_gratis_acima) > 0 ? numeroParaCampo(c.entrega_gratis_acima) : '',
    ...('horario_entrega' in c ? { horario_entrega: c.horario_entrega ?? '' } : {}),
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
          ['distancia', 'Pela distância', 'A cliente digita o endereço e a taxa é calculada pela distância até a loja.'],
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

      <HorarioEGratis cfg={cfg} setCfg={setCfg} paraTela={paraTela} setAviso={setAviso} />

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

/** Vale para os dois modos: horário de entrega (aparece na loja) e entrega grátis a partir de um valor. */
function HorarioEGratis({ cfg, setCfg, paraTela, setAviso }) {
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const temCampos = 'horario_entrega' in cfg

  const salvar = async () => {
    setErro('')
    const gratis = String(cfg.entrega_gratis_acima || '').trim() ? parseBRL(cfg.entrega_gratis_acima) : null
    if (gratis !== null && !(gratis >= 0)) return setErro('Valor da entrega grátis inválido.')
    setSalvando(true)
    try {
      paraTela(await api.salvarConfig({
        horario_entrega: String(cfg.horario_entrega || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n'),
        entrega_gratis_acima: gratis || null,
      }))
      setAviso('Horário e entrega grátis salvos!')
    } catch (e) {
      setErro(/horario_entrega|entrega_gratis|column/i.test(e.message) ? 'Rode a SQL 0012_banners_horario_frete_gratis.sql no Supabase.' : e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="card mb-4 grid gap-4 p-5 lg:grid-cols-2">
      <Campo rotulo="Horário de entrega" ajuda="Uma linha para cada período. Aparece no checkout (quando a cliente escolhe Entrega) e no rodapé do site.">
        <textarea
          rows={3}
          value={cfg.horario_entrega || ''}
          onChange={(e) => setCfg((c) => ({ ...c, horario_entrega: e.target.value }))}
          className="campo"
          placeholder={'Segunda a sexta: 19h às 23h\nSábado e domingo: 9h às 23h'}
        />
      </Campo>
      <div className="space-y-3">
        <Campo rotulo="Entrega grátis a partir de (R$)" ajuda="Pedidos a partir desse valor (já com desconto de cupom) não pagam entrega. Vazio = desligado. Frete a combinar (muito longe) continua a combinar.">
          <input
            inputMode="decimal"
            value={cfg.entrega_gratis_acima ?? ''}
            onChange={(e) => setCfg((c) => ({ ...c, entrega_gratis_acima: e.target.value }))}
            className="campo tnum w-40"
            placeholder="Ex.: 30,00"
          />
        </Campo>
        {!temCampos && <p className="text-xs text-ambar">Para usar estes campos, rode a SQL 0012 no Supabase.</p>}
        <Erro>{erro}</Erro>
        <button type="button" onClick={salvar} disabled={salvando} className="btn-primario w-full">{salvando ? 'Salvando…' : 'Salvar horário e entrega grátis'}</button>
      </div>
    </section>
  )
}

function Distancia({ cfg, setCfg, paraTela, setAviso }) {
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [origemAchada, setOrigemAchada] = useState('')
  const [simEnd, setSimEnd] = useState({ endereco: '', bairro: '' })
  const [sim, setSim] = useState(null)
  const simBairros = useBairrosSugeridos(simEnd.endereco, cfg.origem_lat != null)
  const simPronto = /[a-zà-ú]{3}/i.test(simEnd.endereco) && simEnd.bairro.trim().length >= 3
  const [endereco, setEndereco] = useState('')
  const [buscandoEnd, setBuscandoEnd] = useState(false)
  const [achadoEnd, setAchadoEnd] = useState(null)
  const [cidadeOrigem, setCidadeOrigem] = useState({ cidade: '', uf: '' })

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
      setCidadeOrigem({ cidade: r.cidade || '', uf: r.uf || '' })
      setAchadoEnd(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  // ajuste fino: endereço com número da loja (depois a dona arrasta o pino até a porta)
  const buscarPorEndereco = async () => {
    setErro('')
    setAchadoEnd(null)
    if (!endereco.trim()) return setErro('Digite o endereço da loja, ex.: Rua José Abílio, 804.')
    setBuscandoEnd(true)
    try {
      const perto = cfg.origem_lat != null ? { lat: Number(cfg.origem_lat), lng: Number(cfg.origem_lng) } : null
      const r = await buscarEndereco(endereco, { ...cidadeOrigem, perto })
      if (!r) throw new Error('Não achamos esse endereço. Confira o nome da rua (ex.: Rua José Abílio, 804) ou ajuste o pino no mapa.')
      setCfg((c) => ({ ...c, origem_lat: r.lat, origem_lng: r.lng }))
      setAchadoEnd(r)
      setOrigemAchada('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscandoEnd(false)
    }
  }

  const moverPino = (p) => {
    setCfg((c) => ({ ...c, origem_lat: p.lat, origem_lng: p.lng }))
    setAchadoEnd((a) => ({ ...(a || {}), movido: true }))
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
      setErro(/entrega_gratis_km/i.test(e.message) ? 'Rode a SQL 0013_entrega_gratis_km.sql no Supabase.'
        : /origem|entrega_|column/i.test(e.message) ? 'Rode a SQL 0009_entrega_distancia.sql no Supabase.' : e.message)
    } finally {
      setSalvando(false)
    }
  }

  const simular = async () => {
    setSim({ carregando: true })
    try {
      setSim(await api.cotarEntrega({ endereco: simEnd.endereco.trim(), bairro: simEnd.bairro.trim() }))
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
        <Campo rotulo="Endereço exato da loja (opcional)" ajuda="Para mais precisão: digite a rua e o número e toque em Buscar. Depois confira o pino no mapa e, se precisar, arraste até a porta.">
          <div className="flex gap-2">
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarPorEndereco())}
              className="campo" placeholder="Ex.: Rua José Abílio, 804" autoComplete="street-address" />
            <button type="button" onClick={buscarPorEndereco} disabled={buscandoEnd} className="btn-claro shrink-0">{buscandoEnd ? 'Buscando…' : 'Buscar'}</button>
          </div>
        </Campo>
        {achadoEnd?.rotulo && !achadoEnd.movido && (
          <p className={`-mt-2 text-xs ${achadoEnd.achouNumero ? 'text-verde' : 'text-amber-700'}`}>
            {achadoEnd.achouNumero ? <>Achado: {achadoEnd.rotulo}</> : <>Achamos a rua ({achadoEnd.rotulo}), mas não o número: arraste o pino até a porta da loja.</>}
          </p>
        )}
        {cfg.origem_lat != null && (
          <div className="space-y-1">
            <MapaPino ponto={{ lat: Number(cfg.origem_lat), lng: Number(cfg.origem_lng) }} onMover={moverPino} />
            <p className="text-xs text-magenta/45">
              {achadoEnd?.movido ? 'Pino ajustado. ' : 'Arraste o pino (ou toque no mapa) para marcar a porta da loja. '}
              Depois toque em <strong>Salvar valores da entrega</strong>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Taxa mínima (R$)"><input inputMode="decimal" value={cfg.entrega_taxa_base} onChange={set('entrega_taxa_base')} className="campo tnum" /></Campo>
          <Campo rotulo="Taxa mínima até (km)"><input inputMode="decimal" value={cfg.entrega_raio_km} onChange={set('entrega_raio_km')} className="campo tnum" /></Campo>
          <Campo rotulo="Valor por km (R$)"><input inputMode="decimal" value={cfg.entrega_valor_km} onChange={set('entrega_valor_km')} className="campo tnum" /></Campo>
          <Campo rotulo="Entrega até (km)" ajuda="Acima disso: frete a combinar."><input inputMode="decimal" value={cfg.entrega_max_km} onChange={set('entrega_max_km')} className="campo tnum" /></Campo>
        </div>
        <Campo rotulo="Entrega grátis até (km)" ajuda="Perto da loja a entrega sai grátis. 0,5 = 500 metros; 2 = 2 km. 0 = sem entrega grátis por distância.">
          <input inputMode="decimal" value={cfg.entrega_gratis_km} onChange={set('entrega_gratis_km')} className="campo tnum w-28" />
        </Campo>
        <Campo rotulo="Fator de rota" ajuda="A distância é calculada pelo caminho de moto. Só se o mapa não responder, usa a linha reta multiplicada por este número (1,3 é o normal).">
          <input inputMode="decimal" value={cfg.entrega_fator_rota} onChange={set('entrega_fator_rota')} className="campo tnum w-28" />
        </Campo>
        <p className="rounded-2xl bg-cream px-4 py-3 text-xs text-magenta/70">
          Regra: {regras.entrega_gratis_km > 0 && <>até {formatKm(regras.entrega_gratis_km)} = <strong>grátis</strong>; </>}até {cfg.entrega_raio_km} km = {formatBRL(regras.entrega_taxa_base || 0)}. Acima de {cfg.entrega_raio_km} km: {formatBRL(regras.entrega_taxa_base || 0)} + {formatBRL(regras.entrega_valor_km || 0)} por km a mais
          (km arredondado para cima). Acima de {cfg.entrega_max_km} km o pedido é feito com o frete a combinar pelo WhatsApp.
        </p>
        <Erro>{erro}</Erro>
        <button type="button" onClick={salvar} disabled={salvando} className="btn-primario w-full">{salvando ? 'Salvando…' : 'Salvar valores da entrega'}</button>
      </section>

      <div className="space-y-4">
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold text-magenta">Testar um endereço</h2>
          <p className="text-xs text-magenta/55">Usa os valores já salvos e o mesmo cálculo do checkout: mostra exatamente o que a cliente vai ver.</p>
          <input value={simEnd.endereco} onChange={(e) => setSimEnd((s) => ({ ...s, endereco: e.target.value }))} className="campo" placeholder="Rua e número (ex.: Rua das Flores, 123)" />
          <div className="flex gap-2">
            <input value={simEnd.bairro} onChange={(e) => setSimEnd((s) => ({ ...s, bairro: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && simPronto && simular()} className="campo" placeholder="Bairro" />
            <button type="button" onClick={simular} disabled={!simPronto || sim?.carregando} className="btn-claro shrink-0">Calcular</button>
          </div>
          <SugestoesBairro opcoes={simBairros} valor={simEnd.bairro} titulo="Bairros onde existe essa rua:" onEscolher={(b) => setSimEnd((s) => ({ ...s, bairro: b }))} />
          {sim && (
            <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-magenta">
              {sim.carregando ? 'Calculando…'
                : !sim.ok ? <span className="text-vermelho">{sim.erro}</span>
                  : <>
                      {sim.rotulo ? <>📍 {sim.rotulo}</> : 'Endereço não encontrado no mapa'}
                      {sim.lat != null && <> · <a className="text-xs underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${sim.lat},${sim.lng}`}>ver no mapa</a></>}
                      {sim.lat != null && <span className={`block text-xs ${sim.aproximado ? 'text-ambar' : 'text-verde'}`}>{sim.aproximado ? 'Localização aproximada (o mapa não conhece esse número; o pedido chega marcado como aproximado)' : 'Casa exata encontrada no mapa'}</span>}
                      {sim.km == null
                        ? <>→ <strong>frete a combinar</strong></>
                        : <><strong>{formatKm(sim.km)}</strong>{sim.pela_rua ? " pelas ruas" : " (estimado)"} → {sim.a_combinar ? <strong>frete a combinar</strong> : <strong>{Number(sim.taxa) === 0 ? 'Grátis' : formatBRL(sim.taxa)}</strong>}</>}
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
                    <td className="py-1.5 text-magenta/70">{l.km == null ? `Mais de ${cfg.entrega_max_km} km` : `até ${formatKm(l.km).replace(',0 km', ' km')}`}</td>
                    <td className="tnum py-1.5 text-right font-semibold text-magenta">{l.a_combinar ? 'A combinar' : l.taxa === 0 ? 'Grátis' : formatBRL(l.taxa)}</td>
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
