import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconeImpressora, IconeVoltar, IconeWhatsApp } from '../../components/Icones.jsx'
import { Erro, useAviso } from '../../components/admin/UI.jsx'
import { usePainel } from './AdminLayout.jsx'
import { api } from '../../lib/api.js'
import { formatBRL, formatData, formatTelefone, linkWhatsApp } from '../../lib/format.js'
import { mensagemStatusCliente } from '../../lib/mensagens.js'
import { FORMAS_PAGAMENTO, STATUS_PEDIDO, proximosStatus } from '../../lib/precos.js'

export default function PedidoDetalhe() {
  const { id } = useParams()
  const { versaoPedidos, recontar } = usePainel()
  const [pedido, setPedido] = useState(null)
  const [comprovante, setComprovante] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    api.getPedido(Number(id)).then(setPedido).catch((e) => setErro(e.message))
  }, [id, versaoPedidos])

  useEffect(() => {
    if (!pedido?.comprovante_path) return setComprovante(null)
    api.urlComprovante(pedido.comprovante_path).then(setComprovante).catch(() => setComprovante(null))
  }, [pedido?.comprovante_path])

  if (!pedido) return <p className="text-sm text-magenta/40">{erro || 'Carregando…'}</p>

  const linkCliente = `${window.location.origin}/pedido/${pedido.codigo}?t=${pedido.token}`

  const mudarStatus = async (status) => {
    if (status === 'cancelado' && !confirm('Cancelar este pedido? As peças voltam para o estoque.')) return
    setSalvando(true)
    setErro('')
    try {
      const atualizado = await api.atualizarPedido(pedido.id, { status })
      setPedido(atualizado)
      recontar?.()
      setAviso(`Status: ${STATUS_PEDIDO[status].rotulo}`)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const ehPdf = pedido.comprovante_path?.toLowerCase().endsWith('.pdf') || comprovante?.startsWith('data:application/pdf')

  return (
    <div className="space-y-4">
      {aviso}
      <Link to="/admin/pedidos" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-magenta/60 hover:text-magenta print:hidden">
        <IconeVoltar className="h-4 w-4" /> Pedidos
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-magenta">{pedido.codigo}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_PEDIDO[pedido.status]?.cor}`}>{STATUS_PEDIDO[pedido.status]?.rotulo}</span>
        <span className="text-sm text-magenta/50">{formatData(pedido.created_at)}</span>
      </div>

      {/* Ações */}
      <div className="card flex flex-wrap gap-2 p-4 print:hidden">
        {proximosStatus(pedido).map((s) => (
          <button key={s} type="button" disabled={salvando} onClick={() => mudarStatus(s)} className="btn-primario">
            Marcar como: {STATUS_PEDIDO[s].rotulo}
          </button>
        ))}
        <a href={linkWhatsApp(pedido.cliente_telefone, mensagemStatusCliente(pedido, linkCliente))} target="_blank" rel="noreferrer" className="btn bg-[#25d366] text-white">
          <IconeWhatsApp /> Avisar cliente
        </a>
        <button type="button" onClick={() => window.print()} className="btn-claro"><IconeImpressora /> Imprimir para separar</button>
        <select
          value=""
          onChange={(e) => e.target.value && mudarStatus(e.target.value)}
          className="campo w-auto"
          aria-label="Mudar status manualmente"
        >
          <option value="">Outro status…</option>
          {Object.entries(STATUS_PEDIDO).filter(([k]) => k !== pedido.status).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </select>
        <Erro>{erro}</Erro>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Itens: é isso que ela separa */}
        <section className="card p-5">
          <h2 className="rotulo">Separar</h2>
          <ul className="divide-y divide-blush">
            {pedido.itens.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 rounded-md ring-2 ring-magenta/30 print:ring-black" aria-hidden="true" />
                {i.imagem_url && <img src={i.imagem_url} alt="" className="h-12 w-12 rounded-xl object-cover print:hidden" />}
                <span className="flex-1 text-sm"><strong className="text-base">{i.quantidade}x</strong> {i.nome}</span>
                <span className="tnum text-sm">{formatBRL(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-blush pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tnum">{formatBRL(pedido.subtotal)}</dd></div>
            {Number(pedido.desconto) > 0 && <div className="flex justify-between text-verde"><dt>Cupom {pedido.cupom_codigo}</dt><dd className="tnum">-{formatBRL(pedido.desconto)}</dd></div>}
            {pedido.tipo_entrega === 'entrega' && <div className="flex justify-between"><dt>Entrega</dt><dd className="tnum">{formatBRL(pedido.taxa_entrega)}</dd></div>}
            <div className="flex justify-between text-lg font-bold text-magenta"><dt>Total</dt><dd className="tnum">{formatBRL(pedido.total)}</dd></div>
          </dl>
        </section>

        <div className="space-y-4">
          <section className="card space-y-1.5 p-5 text-sm">
            <h2 className="rotulo">Cliente</h2>
            <p className="text-base font-semibold">{pedido.cliente_nome}</p>
            <a href={linkWhatsApp(pedido.cliente_telefone)} target="_blank" rel="noreferrer" className="block text-magenta underline">{formatTelefone(pedido.cliente_telefone)}</a>
            <p className="pt-2">
              <strong>{pedido.tipo_entrega === 'entrega' ? 'Entregar em:' : 'Vai retirar na loja'}</strong>
              {pedido.tipo_entrega === 'entrega' && (
                <> {pedido.endereco}{pedido.complemento ? `, ${pedido.complemento}` : ''} — <strong>{pedido.bairro_nome}</strong>{pedido.referencia ? ` (ref.: ${pedido.referencia})` : ''}</>
              )}
            </p>
            <p>
              <strong>Pagamento:</strong> {FORMAS_PAGAMENTO[pedido.forma_pagamento]?.rotulo}
              {pedido.troco_para ? <> · <strong>levar troco para {formatBRL(pedido.troco_para)}</strong> ({formatBRL(pedido.troco_para - pedido.total)} de troco)</> : ''}
            </p>
            {pedido.observacao && <p className="rounded-xl bg-ouro-palido px-3 py-2"><strong>Obs.:</strong> {pedido.observacao}</p>}
          </section>

          {pedido.forma_pagamento === 'pix' && (
            <section className="card p-5 print:hidden">
              <h2 className="rotulo">Comprovante Pix</h2>
              {comprovante ? (
                <>
                  {ehPdf ? (
                    <a href={comprovante} target="_blank" rel="noreferrer" className="btn-claro">Abrir PDF do comprovante</a>
                  ) : (
                    <a href={comprovante} target="_blank" rel="noreferrer">
                      <img src={comprovante} alt="Comprovante" className="max-h-96 w-full rounded-2xl bg-cream object-contain" />
                    </a>
                  )}
                  <p className="mt-2 text-xs text-magenta/50">Enviado em {formatData(pedido.comprovante_enviado_em)}. Confira no app do banco se o valor de {formatBRL(pedido.total)} caiu antes de confirmar.</p>
                </>
              ) : (
                <p className="text-sm text-magenta/50">O cliente ainda não enviou o comprovante.</p>
              )}
            </section>
          )}

          <section className="card p-5 text-sm print:hidden">
            <h2 className="rotulo">Link de acompanhamento do cliente</h2>
            <input readOnly value={linkCliente} onFocus={(e) => e.target.select()} className="campo text-xs" />
          </section>
        </div>
      </div>
    </div>
  )
}
