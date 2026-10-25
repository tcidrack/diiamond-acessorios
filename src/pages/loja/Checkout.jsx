import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconeVoltar } from '../../components/Icones.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, parseBRL } from '../../lib/format.js'
import { FORMAS_PAGAMENTO, esgotado } from '../../lib/precos.js'
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

  // sem bairro cadastrado não existe entrega: força retirada
  useEffect(() => {
    if (bairros?.length === 0 && form.tipo_entrega === 'entrega') setForm((f) => ({ ...f, tipo_entrega: 'retirada' }))
  }, [bairros, form.tipo_entrega])

  // o subtotal mudou: o desconto do cupom precisa ser recalculado
  useEffect(() => {
    if (!cupom) return
    api.validarCupom(cupom.codigo, subtotal).then((r) => (r.ok ? setCupom(r) : (setCupom(null), setCupomErro(r.erro))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  const campo = (chave) => (e) => setForm((f) => ({ ...f, [chave]: e.target.value }))
  const listaBairros = bairros || []
  const bairro = listaBairros.find((b) => String(b.id) === String(form.bairro_id))
  const taxa = form.tipo_entrega === 'entrega' ? Number(bairro?.taxa || 0) : 0
  const desconto = cupom?.desconto || 0
  const total = Math.max(0, subtotal - desconto) + taxa

  const aplicarCupom = async () => {
    setCupomErro('')
    if (!cupomTexto.trim()) return
    try {
      const r = await api.validarCupom(cupomTexto, subtotal)
      if (r.ok) setCupom(r)
      else setCupomErro(r.erro)
    } catch (e) {
      setCupomErro(e.message)
    }
  }

  const finalizar = async (e) => {
    e.preventDefault()
    setErro('')
    if (form.tipo_entrega === 'entrega' && !bairro) return setErro('Escolha o bairro de entrega.')
    const troco = form.forma_pagamento === 'dinheiro' && form.troco_para ? parseBRL(form.troco_para) : null
    if (troco !== null && troco < total) return setErro('O valor para troco precisa ser maior que o total.')

    setEnviando(true)
    try {
      const r = await api.criarPedido({
        ...form,
        troco_para: troco,
        cupom: cupom?.codigo || '',
        itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
      })
      const { forma_pagamento, troco_para, observacao, ...dadosCliente } = form
      try { localStorage.setItem(CHAVE_CLIENTE, JSON.stringify(dadosCliente)) } catch { /* modo privado */ }
      if (!compraDireta) carrinho.limpar()
      recarregar()
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
              <Opcao ativo={form.tipo_entrega === 'entrega'} disabled={bairros?.length === 0} onClick={() => setForm((f) => ({ ...f, tipo_entrega: 'entrega' }))} titulo="Entrega" detalhe={bairros?.length === 0 ? 'Indisponível' : 'Taxa por bairro'} />
              <Opcao ativo={form.tipo_entrega === 'retirada'} onClick={() => setForm((f) => ({ ...f, tipo_entrega: 'retirada' }))} titulo="Retirada" detalhe="Sem taxa" />
            </div>

            {form.tipo_entrega === 'entrega' ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <label>
                  <span className="rotulo">Complemento</span>
                  <input value={form.complemento} onChange={campo('complemento')} className="campo" placeholder="Apto, bloco…" />
                </label>
                <label>
                  <span className="rotulo">Ponto de referência</span>
                  <input value={form.referencia} onChange={campo('referencia')} className="campo" placeholder="Perto de…" />
                </label>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm text-magenta/70">
                {config?.endereco_retirada ? <>Retirada em: <strong>{config.endereco_retirada}</strong></> : 'A loja combina o local de retirada com você pelo WhatsApp.'}
                {config?.horario && <span className="block text-xs text-magenta/50">{config.horario}</span>}
              </p>
            )}
          </Secao>

          <Secao numero="3" titulo="Pagamento">
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(FORMAS_PAGAMENTO).map(([chave, f]) => (
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
              {form.tipo_entrega === 'entrega' && <Linha rotulo="Entrega" valor={bairro ? (taxa > 0 ? formatBRL(taxa) : 'Grátis') : '—'} />}
              <div className="flex items-baseline justify-between border-t border-blush pt-2">
                <dt className="font-semibold text-magenta">Total</dt>
                <dd className="tnum text-2xl font-bold text-magenta">{formatBRL(total)}</dd>
              </div>
            </dl>

            {erro && <p className="rounded-xl bg-vermelho-bg/60 px-3 py-2 text-sm text-vermelho" role="alert">{erro}</p>}

            <button type="submit" disabled={enviando || config?.aberta === false} className="btn-primario w-full text-base">
              {enviando ? 'Enviando pedido…' : 'Confirmar pedido'}
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
