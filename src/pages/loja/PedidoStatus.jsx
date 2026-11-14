import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PixPagamento from '../../components/PixPagamento.jsx'
import ConfirmarPix from '../../components/ConfirmarPix.jsx'
import { IconeCheck, IconeDiamante, IconeWhatsApp } from '../../components/Icones.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, formatData, linkWhatsApp } from '../../lib/format.js'
import { mensagemPedidoWhatsApp } from '../../lib/mensagens.js'
import { FORMAS_PAGAMENTO, STATUS_PEDIDO } from '../../lib/precos.js'
import { useLoja } from '../../hooks/useLoja.jsx'

const ETAPAS_ENTREGA = ['recebido', 'confirmado', 'separando', 'saiu_entrega', 'concluido']
const ETAPAS_RETIRADA = ['recebido', 'confirmado', 'separando', 'pronto', 'concluido']
const ROTULO_ETAPA = { recebido: 'Recebido', confirmado: 'Pago', separando: 'Separando', saiu_entrega: 'A caminho', pronto: 'Pronto', concluido: 'Entregue' }

function etapaAtual(status) {
  if (['novo', 'aguardando_pagamento', 'pagamento_enviado'].includes(status)) return 'recebido'
  return status
}

export default function PedidoStatus() {
  const { codigo } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t')
  const novo = params.get('novo') === '1'
  const { config } = useLoja()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const navegar = useNavigate()
  const verificou = useRef(false)

  const carregar = useCallback(async () => {
    if (!token) return setCarregando(false)
    try {
      setDados(await api.consultarPedido(codigo, token))
    } finally {
      setCarregando(false)
    }
  }, [codigo, token])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 20000)
    return () => clearInterval(t)
  }, [carregar])

  // voltou do checkout da InfinitePay: confere o pagamento (reforço caso o webhook demore) e limpa a URL
  useEffect(() => {
    const transaction_nsu = params.get('transaction_nsu')
    if (!token || !transaction_nsu || verificou.current) return
    verificou.current = true
    api.verificarPagamentoCartao(codigo, token, { slug: params.get('slug'), transaction_nsu, receipt_url: params.get('receipt_url') })
      .catch(() => { /* o webhook ainda confirma */ })
      .finally(() => {
        carregar()
        navegar(`/pedido/${codigo}?t=${token}`, { replace: true })
      })
  }, [codigo, token, params, carregar, navegar])

  if (carregando) return <div className="mx-auto mt-8 h-96 max-w-2xl animate-pulse rounded-3xl bg-white/60" />

  if (!dados) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
        <IconeDiamante className="h-12 w-12 text-ouro-claro" />
        <p className="font-display text-xl text-magenta">Pedido não encontrado</p>
        <p className="text-sm text-magenta/55">Confira se o link está completo.</p>
        <Link to="/" className="btn-claro">Voltar para a loja</Link>
      </div>
    )
  }

  const { pedido, itens } = dados
  const link = window.location.href.replace(/&novo=1/, '')
  const cancelado = pedido.status === 'cancelado'
  const etapas = pedido.tipo_entrega === 'entrega' ? ETAPAS_ENTREGA : ETAPAS_RETIRADA
  // dinheiro/cartão na maquininha não passam por "pago" antes de separar
  const pagaAntes = ['pix', 'cartao_online'].includes(pedido.forma_pagamento)
  const etapasVisiveis = pagaAntes ? etapas : etapas.filter((e) => e !== 'confirmado')
  const indice = etapasVisiveis.indexOf(etapaAtual(pedido.status))
  const precisaPix = pedido.forma_pagamento === 'pix' && ['aguardando_pagamento', 'pagamento_enviado', 'novo'].includes(pedido.status)
  const pixInformado = !!pedido.comprovante_enviado_em
  const precisaCartao = pedido.forma_pagamento === 'cartao_online' && !pedido.pago_em && !cancelado
  const textoWhatsApp = pedido.forma_pagamento === 'pix' && precisaPix
    ? (pixInformado ? 'Último passo: avise a loja pelo WhatsApp. Se quiser, encaminhe o comprovante por lá.' : 'Fale com a loja pelo WhatsApp')
    : precisaCartao ? 'Dúvidas sobre o pagamento? Fale com a loja'
    : (novo ? 'Último passo: avise a loja pelo WhatsApp para agilizar' : 'Fale com a loja sobre este pedido')

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <div className="text-center">
        {novo && (
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-verde-bg text-verde">
            <IconeCheck className="h-7 w-7" />
          </span>
        )}
        <h1 className="font-display text-3xl font-semibold text-magenta">{novo ? 'Pedido recebido!' : `Pedido ${pedido.codigo}`}</h1>
        <p className="mt-1 text-sm text-magenta/60">
          {novo ? <>Número do pedido: <strong>{pedido.codigo}</strong> · </> : null}
          {formatData(pedido.created_at)}
        </p>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_PEDIDO[pedido.status]?.cor}`}>
          {STATUS_PEDIDO[pedido.status]?.rotulo}
        </span>
      </div>

      {!cancelado && (
        <ol className="card flex items-start justify-between gap-1 p-4">
          {etapasVisiveis.map((e, i) => (
            <li key={e} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i <= indice ? 'bg-magenta text-white' : 'bg-blush/60 text-magenta/40'}`}>
                {i < indice ? <IconeCheck className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-[11px] leading-tight ${i <= indice ? 'font-semibold text-magenta' : 'text-magenta/45'}`}>{ROTULO_ETAPA[e]}</span>
            </li>
          ))}
        </ol>
      )}

      {precisaPix && (
        <>
          {!pixInformado && pedido.status !== 'pagamento_enviado' && <PixPagamento config={config} valor={pedido.total} codigo={pedido.codigo} />}
          <ConfirmarPix
            codigo={codigo}
            token={token}
            valor={pedido.total}
            recebedor={config?.pix_nome}
            jaInformado={pixInformado || pedido.status === 'pagamento_enviado'}
            onInformado={carregar}
          />
        </>
      )}

      {precisaCartao && <PagarCartao codigo={codigo} token={token} valor={pedido.total} voltando={!!params.get('transaction_nsu')} />}

      {config?.whatsapp && !cancelado && (
        <div className="card p-5 text-center">
          <p className="text-sm text-magenta/70">{textoWhatsApp}</p>
          <a
            href={linkWhatsApp(config.whatsapp, mensagemPedidoWhatsApp(pedido, itens, link))}
            target="_blank"
            rel="noreferrer"
            className="btn mt-3 w-full bg-[#25d366] text-white hover:brightness-95"
          >
            <IconeWhatsApp /> Enviar pedido no WhatsApp
          </a>
        </div>
      )}

      <div className="card space-y-3 p-5 text-sm">
        <h2 className="font-display text-lg font-semibold text-magenta">Itens</h2>
        <ul className="space-y-2">
          {itens.map((i, n) => (
            <li key={n} className="flex items-center gap-3">
              {i.imagem_url && <img src={i.imagem_url} alt="" className="h-11 w-11 rounded-xl object-cover" />}
              <span className="flex-1">{i.quantidade}x {i.nome}</span>
              <span className="tnum">{formatBRL(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-blush pt-3">
          <div className="flex justify-between"><dt className="text-magenta/60">Subtotal</dt><dd className="tnum">{formatBRL(pedido.subtotal)}</dd></div>
          {Number(pedido.desconto) > 0 && <div className="flex justify-between text-verde"><dt>Desconto</dt><dd className="tnum">-{formatBRL(pedido.desconto)}</dd></div>}
          {pedido.tipo_entrega === 'entrega' && <div className="flex justify-between"><dt className="text-magenta/60">Entrega ({pedido.bairro_nome})</dt><dd className="tnum">{formatBRL(pedido.taxa_entrega)}</dd></div>}
          <div className="flex justify-between text-base font-bold text-magenta"><dt>Total</dt><dd className="tnum">{formatBRL(pedido.total)}</dd></div>
        </dl>
        <div className="space-y-1 border-t border-blush pt-3 text-magenta/70">
          <p><strong>Pagamento:</strong> {FORMAS_PAGAMENTO[pedido.forma_pagamento]?.rotulo}{pedido.troco_para ? ` · troco para ${formatBRL(pedido.troco_para)}` : ''}</p>
          <p><strong>{pedido.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}:</strong> {pedido.tipo_entrega === 'entrega' ? `${pedido.endereco}${pedido.complemento ? `, ${pedido.complemento}` : ''} — ${pedido.bairro_nome}` : config?.endereco_retirada || 'combinar com a loja'}</p>
        </div>
      </div>

      <p className="text-center text-xs text-magenta/45">Guarde este link para acompanhar seu pedido. Ele atualiza sozinho.</p>
      <div className="text-center"><Link to="/" className="btn-claro">Voltar para a loja</Link></div>
    </div>
  )
}

function PagarCartao({ codigo, token, valor, voltando }) {
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState('')

  const pagar = async () => {
    setErro('')
    setAbrindo(true)
    try {
      const r = await api.gerarLinkCartao(codigo, token)
      if (r?.url) return window.location.assign(r.url)
      window.location.reload() // já estava pago
    } catch (e) {
      setErro(e.message)
      setAbrindo(false)
    }
  }

  return (
    <div className="card space-y-3 p-5 text-center">
      <h2 className="font-display text-lg font-semibold text-magenta">Pagar com cartão</h2>
      {voltando ? (
        <p className="text-sm text-magenta/70">Conferindo seu pagamento…</p>
      ) : (
        <>
          <p className="text-sm text-magenta/70">
            Total de <strong>{formatBRL(valor)}</strong>, no crédito em até 12x. O pagamento é feito na página segura da InfinitePay.
          </p>
          <button type="button" onClick={pagar} disabled={abrindo} className="btn-primario w-full">
            {abrindo ? 'Abrindo pagamento…' : 'Pagar com cartão'}
          </button>
          <p className="text-xs text-magenta/45">Já pagou? A confirmação aparece aqui sozinha em instantes.</p>
        </>
      )}
      {erro && <p className="rounded-xl bg-vermelho-bg/60 px-3 py-2 text-sm text-vermelho" role="alert">{erro}</p>}
    </div>
  )
}
