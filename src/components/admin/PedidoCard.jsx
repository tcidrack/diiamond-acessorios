import { Link } from 'react-router-dom'
import { formatBRL, formatData } from '../../lib/format.js'
import { FORMAS_PAGAMENTO, STATUS_PEDIDO } from '../../lib/precos.js'

export default function PedidoCard({ pedido }) {
  const status = STATUS_PEDIDO[pedido.status]
  const pecas = (pedido.itens || []).reduce((s, i) => s + i.quantidade, 0)
  return (
    <Link to={`/admin/pedidos/${pedido.id}`} className="card surge flex flex-col gap-2 p-4 transition hover:shadow-lift">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-semibold text-magenta">{pedido.codigo}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status?.cor}`}>{status?.rotulo}</span>
        <span className="ml-auto text-xs text-magenta/45">{formatData(pedido.created_at)}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{pedido.cliente_nome}</p>
          <p className="truncate text-xs text-magenta/55">
            {pecas} {pecas === 1 ? 'peça' : 'peças'} · {pedido.tipo_entrega === 'entrega' ? `Entrega · ${pedido.bairro_nome}` : 'Retirada'} · {FORMAS_PAGAMENTO[pedido.forma_pagamento]?.rotulo}
          </p>
        </div>
        <span className="tnum shrink-0 text-lg font-bold text-magenta">{formatBRL(pedido.total)}</span>
      </div>
    </Link>
  )
}
