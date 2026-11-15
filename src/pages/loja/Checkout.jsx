import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconeVoltar } from '../../components/Icones.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, parseBRL } from '../../lib/format.js'
import { FORMAS_PAGAMENTO, esgotado } from '../../lib/precos.js'
import { ganhaEntregaGratis, linhasHorarioEntrega, minimoEntregaGratis } from '../../lib/entrega.js'
import { itemDoProduto, useCarrinho } from '../../hooks/useCarrinho.jsx'
import { useLoja } from '../../hooks/useLoja.jsx'

const CHAVE_CLIENTE = 'diamond-cliente-v1'

function clienteSalvo() {
  try { return JSON.parse(localStorage.getItem(CHAVE_CLIENTE)) || {} } catch { return {} }
}

export default function Checkout() {
  const carrinho = useCarrinho()
  const { config, produtos, carregando, recarregar } = useLoja()
  const navegar = useNavigate()

  // "Comprar agora": /checkout?comprar=<id>&qtd=N compra só esse item e não mexe no carrinho
  const [params] = useSearchParams()
  const comprarId = params.get('comprar')
  const compraDireta = useMemo(() => {
    if (!comprarId) return null
    const p = produtos.find((x) => String(x.id) === comprarId)
    return p && !esgotado(p) ? [itemDoProduto(p, Number(params.get('qtd')) || 1)] : []
  }, [comprarId, params, produtos])
  const itens = compraDireta || carrinho.itens
  const subtotal = compraDireta ? compraDireta.reduce((s, i) => s + i.preco * i.quantidade, 0) : carrinho.subtotal
  const salvo = clienteSalvo()

  const [bairros, setBairros] = useState(null) // null = ainda carregando
  const [form, setForm] = useState({
    cliente_nome: salvo.cliente_nome || '',
    cliente_telefone: salvo.cliente_telefone || '',
    tipo_entrega: salvo.tipo_entrega || 'entrega',
    bairro_id: salvo.bairro_id || '',
    cep: salvo.cep || '',
    bairro: salvo.bairro || '',
    endereco: salvo.endereco || '',
    complemento: salvo.complemento || '',
    referencia: salvo.referencia || '',
    forma_pagamento: 'pix',
    troco_para: '',
    observacao: '',
  })
  const [cupomTexto, setCupomTexto] = useState('')
  const [cupom, setCupom] = useState(null)
  const [cupomErro, setCupomErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.listBairros().then(setBairros).catch(() => setBairros([]))
  }, [])

  // entrega por distância (CEP) ou pela lista de bairros, conforme o painel
  const modoDistancia = config?.entrega_modo === 'distancia'
  const entregaIndisponivel = modoDistancia ? config?.origem_lat == null : bairros?.length === 0

  // sem como calcular a entrega: força retirada
  useEffect(() => {
    if (config && entregaIndisponivel && form.tipo_entrega === 'entrega') setForm((f) => ({ ...f, tipo_entrega: 'retirada' }))
  }, [config, entregaIndisponivel, form.tipo_entrega])

  // entrega pela distância: calcula pelo endereço exato (rua, número e bairro), sem CEP
  const [cotacao, setCotacao] = useState(null) // null | { carregando } | resposta de cotarEntrega (+ chave)
  const enderecoPronto = /[a-zà-ú]{3}/i.test(form.endereco) && form.endereco.trim().length >= 5 && form.bairro.trim().length >= 3
  const chaveEndereco = `${form.endereco.trim().replace(/\s+/g, ' ').toLowerCase()}|${form.bairro.trim().replace(/\s+/g, ' ').toLowerCase()}`
  const calcularPelaDistancia = modoDistancia && form.tipo_entrega === 'entrega'
  const cotacoes = useRef(new Map()) // chave → promessa (não repete a mesma busca)
  const cotar = (chave, endereco, bairro) => {
    if (!cotacoes.current.has(chave)) {
      cotacoes.current.set(chave, api.cotarEntrega({ endereco, bairro })
        .then((r) => ({ ...r, chave }))
        .catch((e) => ({ ok: false, erro: e.message, chave })))
    }
    return cotacoes.current.get(chave)
  }
  useEffect(() => {
    if (!calcularPelaDistancia || !enderecoPronto) {
      setCotacao(null)
      return
    }
    if (cotacao?.chave === chaveEndereco) return
    let ativo = true
    const t = setTimeout(() => {
      setCotacao((c) => (c?.ok ? { ...c, atualizando: true } : { carregando: true }))
      cotar(chaveEndereco, form.endereco.trim(), form.bairro.trim()).then((r) => ativo && setCotacao(r))
    }, 900)
    return () => { ativo = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcularPelaDistancia, enderecoPronto, chaveEndereco])

  // só os dígitos, e só quando o número está completo: o cupom pode ter limite por cliente
  const digitosTel = form.cliente_telefone.replace(/\D/g, '')
  const telCupom = digitosTel.length >= 10 ? digitosTel : ''

  // o subtotal ou o WhatsApp mudou: o cupom precisa ser conferido de novo
  useEffect(() => {
    if (!cupom) return
    const t = setTimeout(() => {
      api.validarCupom(cupom.codigo, subtotal, telCupom)
        .then((r) => (r.ok ? setCupom(r) : (setCupom(null), setCupomErro(r.erro))))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, telCupom])

  const campo = (chave) => (e) => setForm((f) => ({ ...f, [chave]: e.target.value }))
  const listaBairros = bairros || []
  const bairro = listaBairros.find((b) => String(b.id) === String(form.bairro_id))
  const freteOk = !!cotacao?.ok && !cotacao.carregando
  const freteCombinar = modoDistancia && freteOk && cotacao.a_combinar
  const desconto = cupom?.desconto || 0
  const taxaNormal = form.tipo_entrega !== 'entrega' ? 0
    : modoDistancia ? (freteOk ? Number(cotacao.taxa) || 0 : 0)
      : Number(bairro?.taxa || 0)
  // entrega grátis a partir de um valor (o banco aplica a mesma regra)
  const minGratis = minimoEntregaGratis(config)
  const gratisPorValor = form.tipo_entrega === 'entrega' && !freteCombinar && ganhaEntregaGratis(Math.max(0, subtotal - desconto), config)
  const taxa = gratisPorValor ? 0 : taxaNormal
  const faltaGratis = minGratis > 0 && !gratisPorValor && !freteCombinar && taxaNormal > 0 ? minGratis - Math.max(0, subtotal - desconto) : 0
  const horarioEntrega = linhasHorarioEntrega(config)
  const total = Math.max(0, subtotal - desconto) + taxa
  const formasPagamento = Object.entries(FORMAS_PAGAMENTO).filter(([chave]) => chave !== 'cartao_online' || config?.infinitepay_handle)

  const aplicarCupom = async () => {
    setCupomErro('')
    if (!cupomTexto.trim()) return
    try {
      const r = await api.validarCupom(cupomTexto, subtotal, telCupom)
      if (r.ok) setCupom(r)
      else setCupomErro(r.erro)
    } catch (e) {
      setCupomErro(e.message)
    }
  }

  const finalizar = async (e) => {
    e.preventDefault()
    setErro('')
    if (form.tipo_entrega === 'entrega' && !modoDistancia && !bairro) return setErro('Escolha o bairro de entrega.')
    if (calcularPelaDistancia && !enderecoPronto) return setErro('Digite a rua com o número e o bairro para calcular a entrega.')
    const troco = form.forma_pagamento === 'dinheiro' && form.troco_para ? parseBRL(form.troco_para) : null
    if (troco !== null && troco < total) return setErro('O valor para troco precisa ser maior que o total.')

    // entrega ainda sendo calculada (ou endereço mudou): calcula agora e, se o valor mudou, pede para conferir
    let cot = cotacao
    if (calcularPelaDistancia && cotacao?.chave !== chaveEndereco) {
      setEnviando(true)
      cot = await cotar(chaveEndereco, form.endereco.trim(), form.bairro.trim())
      setEnviando(false)
      setCotacao(cot)
      const viu = cotacao?.ok && !cotacao.carregando ? cotacao : null
      if (cot.ok && (!viu || Number(cot.taxa) !== Number(viu.taxa) || !!cot.a_combinar !== !!viu.a_combinar)) {
        return setErro('O valor da entrega foi calculado para o seu endereço. Confira o total e toque em enviar de novo.')
      }
    }
    if (calcularPelaDistancia && !cot?.ok) return setErro(cot?.erro || 'Não conseguimos calcular a entrega. Confira o endereço.')

    setEnviando(true)
    try {
      const r = await api.criarPedido({
        ...form,
        troco_para: troco,
        cupom: cupom?.codigo || '',
        // ponto do endereço (o banco recalcula a taxa com ele); CEP não é mais pedido
        ...(calcularPelaDistancia ? { cep: '', lat: cot?.lat ?? null, lng: cot?.lng ?? null, km_rota: cot?.km_rota ?? null, aproximado: !!cot?.aproximado } : {}),
        itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
      })
      const { forma_pagamento, troco_para, observacao, cepDoBairro, ...dadosCliente } = form
      try { localStorage.setItem(CHAVE_CLIENTE, JSON.stringify(dadosCliente)) } catch { /* modo privado */ }
      if (!compraDireta) carrinho.limpar()
      recarregar()
      if (form.forma_pagamento === 'cartao_online') {
        // vai direto para o checkout da InfinitePay; se falhar, a página do pedido tem o botão de pagar
        try {
          const link = await api.gerarLinkCartao(r.codigo, r.token)
          if (link?.url) return window.location.assign(link.url)
        } catch { /* segue para a página do pedido */ }
      }
      navegar(`/pedido/${r.codigo}?t=${r.token}&novo=1`, { replace: true })
    } catch (err) {
      setErro(err.message)
      recarregar()
    } finally {
      setEnviando(false)
    }
  }

  if (comprarId && carregando) {
    return <div className="mx-auto mt-8 h-96 max-w-6xl animate-pulse rounded-3xl bg-white/60 px-4" />
  }

  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-display text-xl text-magenta">{compraDireta ? 'Este produto não está disponível' : 'Seu carrinho está vazio'}</p>
        <Link to="/" className="btn-claro">Ver produtos</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <Link to="/" className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-magenta/60 hover:text-magenta">
        <IconeVoltar className="h-4 w-4" /> Continuar comprando
      </Link>
      <h1 className="font-display text-3xl font-semibold text-magenta">Finalizar pedido</h1>

      <form onSubmit={finalizar} className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Secao numero="1" titulo="Seus dados">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="rotulo">Nome</span>
                <input required autoComplete="name" value={form.cliente_nome} onChange={campo('cliente_nome')} className="campo" placeholder="Seu nome" />
              </label>
              <label>
                <span className="rotulo">WhatsApp</span>
                <input required type="tel" inputMode="tel" autoComplete="tel" value={form.cliente_telefone} onChange={campo('cliente_telefone')} className="campo" placeholder="(61) 99999-9999" />
              </label>
            </div>
          </Secao>

          <Secao numero="2" titulo="Entrega ou retirada">
            <div className="grid grid-cols-2 gap-2">
              <Opcao ativo={form.tipo_entrega === 'entrega'} disabled={entregaIndisponivel} onClick={() => setForm((f) => ({ ...f, tipo_entrega: 'entrega' }))} titulo="Entrega" detalhe={entregaIndisponivel ? 'Indisponível' : modoDistancia ? 'Taxa pela distância' : 'Taxa por bairro'} />
              <Opcao ativo={form.tipo_entrega === 'retirada'} onClick={() => setForm((f) => ({ ...f, tipo_entrega: 'retirada' }))} titulo="Retirada" detalhe="Sem taxa" />
            </div>

            {form.tipo_entrega === 'entrega' && horarioEntrega.length > 0 && (
              <div className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm text-magenta/80">
                <p className="font-semibold text-magenta">🕒 Horário de entrega</p>
                {horarioEntrega.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}

            {form.tipo_entrega === 'entrega' ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {modoDistancia ? (
                  <>
                    <label className="sm:col-span-2">
                      <span className="rotulo">Endereço (rua e número)</span>
                      <input required autoComplete="street-address" value={form.endereco} onChange={campo('endereco')} className="campo" placeholder="Ex.: Rua Luminosa, 2073" />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="rotulo">Bairro</span>
                      <input required value={form.bairro} onChange={campo('bairro')} className="campo" placeholder="Seu bairro" />
                    </label>
                    <div
                      className={`sm:col-span-2 rounded-2xl px-4 py-3 text-sm ${!cotacao || cotacao.carregando ? 'bg-cream text-magenta/60' : freteCombinar ? 'bg-ambar-bg text-ambar' : freteOk ? 'bg-verde-bg text-verde' : 'bg-vermelho-bg/60 text-vermelho'}`}
                      role="status"
                    >
                      {!cotacao ? 'Digite a rua com o número e o bairro para calcular a entrega.'
                        : cotacao.carregando ? 'Calculando a entrega…'
                          : !freteOk ? cotacao.erro
                            : <>
                                {cotacao.rotulo && (
                                  <span className="mb-0.5 block text-xs opacity-80">
                                    📍 {cotacao.rotulo}{cotacao.aproximado ? ' (localização aproximada)' : ''}
                                  </span>
                                )}
                                {freteCombinar ? (cotacao.km == null
                                  ? <>Não encontramos esse endereço no mapa. O frete é <strong>combinado pelo WhatsApp</strong> depois do pedido e não entra no total abaixo.</>
                                  : <>Seu endereço fica fora da área de entrega padrão. O frete é <strong>combinado pelo WhatsApp</strong> depois do pedido (entrega por aplicativo) e não entra no total abaixo.</>)
                                  : gratisPorValor && taxaNormal > 0
                                    ? <>Entrega: <s className="opacity-60">{formatBRL(taxaNormal)}</s> <strong>grátis</strong> 🎉</>
                                    : <>Entrega: <strong>{taxa > 0 ? formatBRL(taxa) : 'grátis'}</strong></>}
                                {cotacao.atualizando && <span className="ml-1 text-xs opacity-70">atualizando…</span>}
                              </>}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="sm:col-span-2">
                      <span className="rotulo">Bairro</span>
                      <select required value={form.bairro_id} onChange={campo('bairro_id')} className="campo">
                        <option value="">Escolha o bairro…</option>
                        {listaBairros.map((b) => (
                          <option key={b.id} value={b.id}>{b.nome} — {Number(b.taxa) > 0 ? formatBRL(b.taxa) : 'grátis'}</option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs text-magenta/45">Não achou seu bairro? Chame a loja no WhatsApp.</span>
                    </label>
                    <label className="sm:col-span-2">
                      <span className="rotulo">Endereço (rua, número)</span>
                      <input required autoComplete="street-address" value={form.endereco} onChange={campo('endereco')} className="campo" placeholder="Rua, quadra, número" />
                    </label>
                  </>
                )}
                <label>
                  <span className="rotulo">Complemento</span>
                  <input value={form.complemento} onChange={campo('complemento')} className="campo" placeholder="Apto, bloco…" />
                </label>
                <label>
                  <span className="rotulo">Ponto de referência</span>
                  <input value={form.referencia} onChange={campo('referencia')} className="campo" placeholder="Perto de…" />
                </label>
                {faltaGratis > 0 && (
                  <p className="sm:col-span-2 rounded-2xl bg-blush/40 px-4 py-2.5 text-sm text-magenta">
                    Faltam <strong>{formatBRL(faltaGratis)}</strong> para a entrega sair <strong>grátis</strong> 💖
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm text-magenta/70">
                {config?.endereco_retirada ? <>Retirada em: <strong>{config.endereco_retirada}</strong></> : 'A loja combina o local de retirada com você pelo WhatsApp.'}
                {config?.horario && <span className="block text-xs text-magenta/50">{config.horario}</span>}
              </p>
            )}
          </Secao>

          <Secao numero="3" titulo="Pagamento">
            <div className={`grid gap-2 ${formasPagamento.length > 3 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {formasPagamento.map(([chave, f]) => (
                <Opcao key={chave} ativo={form.forma_pagamento === chave} onClick={() => setForm((x) => ({ ...x, forma_pagamento: chave }))} titulo={f.rotulo} detalhe={f.detalhe} />
              ))}
            </div>
            {form.forma_pagamento === 'dinheiro' && (
              <label className="mt-4 block">
                <span className="rotulo">Precisa de troco? Para quanto?</span>
                <input inputMode="decimal" value={form.troco_para} onChange={campo('troco_para')} className="campo" placeholder="Deixe vazio se não precisar" />
              </label>
            )}
            {form.forma_pagamento === 'pix' && (
              <p className="mt-3 text-xs text-magenta/55">Na próxima tela aparece o QR Code com o valor certinho. Depois de pagar, é só tocar em “Já fiz o Pix”.</p>
            )}
            {form.forma_pagamento === 'cartao_online' && (
              <p className="mt-3 text-xs text-magenta/55">Ao confirmar, você vai para a página segura da InfinitePay para pagar com cartão. Depois volta sozinha para cá.</p>
            )}
          </Secao>

          <Secao numero="4" titulo="Observações (opcional)">
            <textarea value={form.observacao} onChange={campo('observacao')} rows={2} maxLength={500} className="campo" placeholder="É presente? Quer embalagem especial? Conte aqui." />
          </Secao>
        </div>

        {/* Resumo */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="card space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold text-magenta">Resumo</h2>
            {compraDireta && carrinho.itens.length > 0 && (
              <p className="-mt-2 rounded-xl bg-ouro-palido px-3 py-2 text-xs text-[#7a5f00]">
                Comprando só este item. Seu carrinho continua salvo.
              </p>
            )}
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {itens.map((i) => (
                <li key={i.produto_id} className="flex gap-3 text-sm">
                  {i.imagem && <img src={i.imagem} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />}
                  <span className="flex-1"><span className="font-semibold">{i.quantidade}x</span> {i.nome}</span>
                  <span className="tnum">{formatBRL(i.preco * i.quantidade)}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <input value={cupomTexto} onChange={(e) => setCupomTexto(e.target.value.toUpperCase())} placeholder="Cupom" aria-label="Cupom de desconto" className="campo uppercase" disabled={!!cupom} />
              {cupom ? (
                <button type="button" onClick={() => { setCupom(null); setCupomTexto('') }} className="btn-claro">Remover</button>
              ) : (
                <button type="button" onClick={aplicarCupom} className="btn-claro">Aplicar</button>
              )}
            </div>
            {cupomErro && <p className="-mt-2 text-xs text-vermelho">{cupomErro}</p>}

            <dl className="space-y-1.5 border-t border-blush pt-3 text-sm">
              <Linha rotulo="Subtotal" valor={formatBRL(subtotal)} />
              {desconto > 0 && <Linha rotulo={`Cupom ${cupom.codigo}`} valor={`-${formatBRL(desconto)}`} verde />}
              {form.tipo_entrega === 'entrega' && (
                <Linha
                  rotulo="Entrega"
                  valor={freteCombinar ? 'A combinar' : (modoDistancia ? freteOk : bairro) ? (taxa > 0 ? formatBRL(taxa) : 'Grátis') : '—'}
                />
              )}
              <div className="flex items-baseline justify-between border-t border-blush pt-2">
                <dt className="font-semibold text-magenta">Total</dt>
                <dd className="tnum text-2xl font-bold text-magenta">{formatBRL(total)}</dd>
              </div>
            </dl>

            {erro && <p className="rounded-xl bg-vermelho-bg/60 px-3 py-2 text-sm text-vermelho" role="alert">{erro}</p>}

            <button type="submit" disabled={enviando || config?.aberta === false} className="btn-primario w-full text-base">
              {enviando ? 'Enviando pedido…' : form.forma_pagamento === 'cartao_online' ? 'Confirmar e pagar' : 'Confirmar pedido'}
            </button>
            <p className="text-center text-xs text-magenta/45">Os valores são conferidos pela loja ao confirmar.</p>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Secao({ numero, titulo, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-semibold text-magenta">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ouro-palido font-sans text-sm text-[#7a5f00] ring-1 ring-ouro/40">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Opcao({ ativo, titulo, detalhe, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl px-4 py-2.5 text-left ring-1 transition disabled:opacity-40 ${
        ativo ? 'bg-blush/60 ring-2 ring-magenta' : 'bg-white ring-blush hover:bg-cream'
      }`}
      {...props}
    >
      <span className="font-semibold text-magenta">{titulo}</span>
      {detalhe && <span className="text-xs leading-snug text-magenta/55">{detalhe}</span>}
    </button>
  )
}

function Linha({ rotulo, valor, verde }) {
  return (
    <div className="flex justify-between">
      <dt className="text-magenta/60">{rotulo}</dt>
      <dd className={`tnum ${verde ? 'font-semibold text-verde' : ''}`}>{valor}</dd>
    </div>
  )
}
