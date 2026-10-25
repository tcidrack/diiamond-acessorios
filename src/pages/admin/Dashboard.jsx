import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PedidoCard from '../../components/admin/PedidoCard.jsx'
import { Titulo, Vazio } from '../../components/admin/UI.jsx'
import { usePainel } from './AdminLayout.jsx'
import { api } from '../../lib/api.js'
import { formatBRL } from '../../lib/format.js'

const PENDENTES = ['novo', 'aguardando_pagamento', 'pagamento_enviado', 'confirmado', 'separando']

export default function Dashboard() {
  const { versaoPedidos } = usePainel()
  const [pedidos, setPedidos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)
    // pega o mês atual e pedidos em aberto mais antigos
    const desde = new Date(Math.min(inicioMes.getTime(), Date.now() - 1000 * 60 * 60 * 24 * 30)).toISOString()
    api.listPedidos({ desde }).then(setPedidos).catch(() => {})
  }, [versaoPedidos])

  useEffect(() => {
    api.listProdutos({ todos: true }).then(setProdutos).catch(() => {})
    api.getConfig().then(setConfig).catch(() => {})
  }, [])

  const resumo = useMemo(() => {
    const hoje = new Date().toDateString()
    const mes = new Date().getMonth()
    const validos = pedidos.filter((p) => p.status !== 'cancelado')
    const doDia = validos.filter((p) => new Date(p.created_at).toDateString() === hoje)
    const doMes = validos.filter((p) => new Date(p.created_at).getMonth() === mes)
    const vendidos = {}
    doMes.forEach((p) => p.itens?.forEach((i) => {
      vendidos[i.nome] = (vendidos[i.nome] || 0) + i.quantidade
    }))
    return {
      hojeQtd: doDia.length,
      hojeValor: doDia.reduce((s, p) => s + Number(p.total), 0),
      mesQtd: doMes.length,
      mesValor: doMes.reduce((s, p) => s + Number(p.total), 0),
      ticket: doMes.length ? doMes.reduce((s, p) => s + Number(p.total), 0) / doMes.length : 0,
      maisVendidos: Object.entries(vendidos).sort((a, b) => b[1] - a[1]).slice(0, 5),
      pendentes: pedidos.filter((p) => PENDENTES.includes(p.status)),
    }
  }, [pedidos])

  const estoqueBaixo = produtos.filter((p) => p.ativo && p.estoque !== null && p.estoque <= 2)

  const alternarLoja = async () => {
    setConfig(await api.salvarConfig({ aberta: !config.aberta }))
  }

  return (
    <>
      <Titulo
        acao={config && (
          <button type="button" onClick={alternarLoja} className={config.aberta ? 'btn bg-verde-bg text-verde' : 'btn bg-vermelho-bg text-vermelho'}>
            <span className="relative flex h-2.5 w-2.5">{config.aberta && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verde opacity-50" />}<span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.aberta ? 'bg-verde' : 'bg-vermelho'}`} /></span>
            {config.aberta ? 'Loja aberta' : 'Loja fechada'} <span className="text-xs font-normal opacity-70">(tocar para mudar)</span>
          </button>
        )}
      >
        Olá!
      </Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo rotulo="Pedidos hoje" valor={resumo.hojeQtd} detalhe={formatBRL(resumo.hojeValor)} />
        <Resumo rotulo="Vendas no mês" valor={formatBRL(resumo.mesValor)} detalhe={`${resumo.mesQtd} pedidos`} />
        <Resumo rotulo="Ticket médio" valor={formatBRL(resumo.ticket)} detalhe="no mês" />
        <Resumo rotulo="Em aberto" valor={resumo.pendentes.length} detalhe="para cuidar" destaque={resumo.pendentes.length > 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-magenta">Pedidos para cuidar</h2>
            <Link to="/admin/pedidos" className="text-sm font-medium text-magenta/60 underline">ver todos</Link>
          </div>
          {resumo.pendentes.length === 0 ? (
            <Vazio>Tudo em dia por aqui.</Vazio>
          ) : (
            <div className="grid gap-3">{resumo.pendentes.slice(0, 8).map((p) => <PedidoCard key={p.id} pedido={p} />)}</div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="rotulo">Mais vendidos no mês</h2>
            {resumo.maisVendidos.length === 0 ? (
              <p className="text-sm text-magenta/45">Ainda sem vendas este mês.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {resumo.maisVendidos.map(([nome, qtd], i) => (
                  <li key={nome} className="flex gap-2"><span className="text-ouro">{i + 1}.</span><span className="flex-1 truncate">{nome}</span><span className="tnum font-semibold">{qtd}</span></li>
                ))}
              </ol>
            )}
          </section>
          <section className="card p-5">
            <h2 className="rotulo">Estoque acabando</h2>
            {estoqueBaixo.length === 0 ? (
              <p className="text-sm text-magenta/45">Nenhum produto com estoque baixo.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {estoqueBaixo.map((p) => (
                  <li key={p.id}>
                    <Link to={`/admin/produtos/${p.id}`} className="flex gap-2 hover:underline">
                      <span className="flex-1 truncate">{p.nome}</span>
                      <span className={`font-semibold ${p.estoque === 0 ? 'text-vermelho' : 'text-ambar'}`}>{p.estoque === 0 ? 'esgotado' : `${p.estoque} un.`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}

function Resumo({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className={`card p-4 ${destaque ? 'borda-ouro border bg-ouro-palido shadow-ouro' : ''}`}>
      <p className="text-[11px] font-semibold tracking-widest text-magenta/50 uppercase">{rotulo}</p>
      <p className="tnum mt-1 text-2xl font-bold text-magenta">{valor}</p>
      <p className="text-xs text-magenta/50">{detalhe}</p>
    </div>
  )
}
