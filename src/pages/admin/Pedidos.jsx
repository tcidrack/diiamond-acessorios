import { useEffect, useMemo, useState } from 'react'
import PedidoCard from '../../components/admin/PedidoCard.jsx'
import { Titulo, Vazio, Erro } from '../../components/admin/UI.jsx'
import { usePainel } from './AdminLayout.jsx'
import { api } from '../../lib/api.js'

const FILTROS = {
  ativos: { rotulo: 'Em aberto', status: ['novo', 'aguardando_pagamento', 'pagamento_enviado', 'confirmado', 'separando', 'pronto', 'saiu_entrega'] },
  conferir: { rotulo: 'Conferir Pix', status: ['pagamento_enviado'] },
  aguardando: { rotulo: 'Aguardando Pix', status: ['aguardando_pagamento'] },
  separar: { rotulo: 'Para separar', status: ['novo', 'confirmado', 'separando'] },
  concluidos: { rotulo: 'Concluídos', status: ['concluido'] },
  cancelados: { rotulo: 'Cancelados', status: ['cancelado'] },
  todos: { rotulo: 'Todos', status: null },
}

export default function Pedidos() {
  const { versaoPedidos } = usePainel()
  const [pedidos, setPedidos] = useState([])
  const [filtro, setFiltro] = useState('ativos')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.listPedidos().then(setPedidos).catch((e) => setErro(e.message)).finally(() => setCarregando(false))
  }, [versaoPedidos])

  const lista = useMemo(() => {
    const st = FILTROS[filtro].status
    const t = busca.trim().toLowerCase()
    return pedidos.filter((p) =>
      (!st || st.includes(p.status)) &&
      (!t || p.codigo.toLowerCase().includes(t) || p.cliente_nome.toLowerCase().includes(t) || p.cliente_telefone.includes(t.replace(/\D/g, '') || '§')),
    )
  }, [pedidos, filtro, busca])

  const contagem = (chave) => {
    const st = FILTROS[chave].status
    return st ? pedidos.filter((p) => st.includes(p.status)).length : pedidos.length
  }

  return (
    <>
      <Titulo>Pedidos</Titulo>
      <div className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {Object.entries(FILTROS).map(([chave, f]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setFiltro(chave)}
            className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap ${filtro === chave ? 'bg-magenta text-white' : 'bg-white text-magenta/70 ring-1 ring-blush'}`}
          >
            {f.rotulo} <span className="opacity-60">{contagem(chave)}</span>
          </button>
        ))}
      </div>
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome ou telefone" className="campo mt-3" />
      <div className="mt-4">
        <Erro>{erro}</Erro>
        {carregando ? (
          <p className="text-sm text-magenta/40">Carregando…</p>
        ) : lista.length === 0 ? (
          <Vazio>Nenhum pedido aqui.</Vazio>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{lista.map((p) => <PedidoCard key={p.id} pedido={p} />)}</div>
        )}
      </div>
    </>
  )
}
