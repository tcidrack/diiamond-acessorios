import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo.jsx'
import {
  IconeAjustes, IconeBrilho, IconeCategorias, IconeCupom, IconeEntrega, IconeExterno, IconeInicio,
  IconeMensagem, IconeMenu, IconePedidos, IconeProdutos, IconeSair, IconeSino,
} from '../../components/Icones.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../lib/api.js'
import { MODO_DEMO } from '../../lib/supabase.js'
import { formatBRL } from '../../lib/format.js'
import { destravarSom, notificar, pedirPermissaoNotificacao, somDestravado, tocarPlim } from '../../lib/alerta.js'

const PainelContext = createContext({ pendentes: 0, conversasDona: 0, versaoPedidos: 0 })
export const usePainel = () => useContext(PainelContext)

// Direct e Assistente IA só aparecem depois que o bot do Instagram estiver ligado (VITE_IA_ATIVA=true).
const IA_ATIVA = MODO_DEMO || import.meta.env.VITE_IA_ATIVA === 'true'

const MENU = [
  { to: '/admin', rotulo: 'Início', Icone: IconeInicio, fim: true },
  { to: '/admin/pedidos', rotulo: 'Pedidos', Icone: IconePedidos, contador: 'pendentes' },
  { to: '/admin/produtos', rotulo: 'Produtos', Icone: IconeProdutos },
  ...(IA_ATIVA
    ? [
        { to: '/admin/conversas', rotulo: 'Direct', Icone: IconeMensagem, contador: 'conversasDona' },
        { to: '/admin/assistente', rotulo: 'Assistente IA', Icone: IconeBrilho },
      ]
    : []),
  { to: '/admin/categorias', rotulo: 'Categorias', Icone: IconeCategorias, extra: true },
  { to: '/admin/entrega', rotulo: 'Entrega', Icone: IconeEntrega, extra: true },
  { to: '/admin/cupons', rotulo: 'Cupons', Icone: IconeCupom, extra: true },
  { to: '/admin/configuracoes', rotulo: 'Configurações', Icone: IconeAjustes, extra: true },
]

const STATUS_PENDENTES = ['novo', 'aguardando_pagamento', 'pagamento_enviado', 'confirmado']

export default function AdminLayout() {
  const { carregando, usuario, admin } = useAuth()
  const navegar = useNavigate()
  const [pendentes, setPendentes] = useState(0)
  const [conversasDona, setConversasDona] = useState(0)
  const [versaoPedidos, setVersaoPedidos] = useState(0)
  const [alertasAtivos, setAlertasAtivos] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)

  const contar = useCallback(async () => {
    try {
      const desde = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
      const pedidos = await api.listPedidos({ desde })
      setPendentes(pedidos.filter((p) => STATUS_PENDENTES.includes(p.status)).length)
      if (IA_ATIVA) {
        const conversas = await api.listar('ig_conversas')
        setConversasDona(conversas.filter((c) => c.precisa_dona).length)
      }
    } catch { /* contador é só enfeite: não quebra o painel */ }
  }, [])

  useEffect(() => {
    if (!admin) return
    contar()
    const pararPedidos = api.assinar('pedidos', ({ tipo, novo, antigo }) => {
      setVersaoPedidos((v) => v + 1)
      contar()
      const comprovanteNovo = tipo === 'UPDATE' && novo.comprovante_enviado_em && novo.comprovante_enviado_em !== antigo?.comprovante_enviado_em
      if (tipo === 'INSERT' || comprovanteNovo) {
        tocarPlim()
        notificar(
          tipo === 'INSERT' ? `Novo pedido ${novo.codigo} 💎` : `Pix informado · ${novo.codigo}`,
          `${novo.cliente_nome} · ${formatBRL(novo.total)}`,
          `/admin/pedidos/${novo.id}`,
        )
      }
    })
    const pararConversas = IA_ATIVA
      ? api.assinar('ig_conversas', ({ novo, antigo }) => {
          contar()
          if (novo?.precisa_dona && !antigo?.precisa_dona) {
            tocarPlim()
            notificar('O Direct precisa de você', `${novo.nome || novo.username || 'Cliente'}: ${novo.ultima_mensagem || ''}`, '/admin/conversas')
          }
        })
      : () => {}
    return () => {
      pararPedidos()
      pararConversas()
    }
  }, [admin, contar])

  if (carregando) return <div className="flex min-h-dvh items-center justify-center text-magenta/40">Carregando…</div>
  if (!usuario || !admin) return <Navigate to="/admin/login" replace />

  const ativarAlertas = async () => {
    destravarSom()
    await pedirPermissaoNotificacao()
    tocarPlim()
    setAlertasAtivos(true)
  }

  const contadores = { pendentes, conversasDona }
  const item = (m, mobile = false) => (
    <NavLink
      key={m.to}
      to={m.to}
      end={m.fim}
      onClick={() => setMenuAberto(false)}
      className={({ isActive }) =>
        mobile
          ? `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-magenta' : 'text-magenta/45'}`
          : `relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
      }
    >
      <m.Icone className={mobile ? 'h-[22px] w-[22px]' : 'h-5 w-5 shrink-0 text-ouro-claro'} />
      {m.rotulo}
      {m.contador && contadores[m.contador] > 0 && (
        <span className={`${mobile ? 'absolute top-1 right-[calc(50%-22px)]' : 'ml-auto'} flex h-5 min-w-5 items-center justify-center rounded-full bg-ouro px-1 text-[11px] font-bold text-white`}>
          {contadores[m.contador]}
        </span>
      )}
    </NavLink>
  )

  return (
    <PainelContext.Provider value={{ pendentes, conversasDona, versaoPedidos, recontar: contar }}>
      <div className="min-h-dvh lg:flex">
        {/* Menu lateral (computador) */}
        <aside className="hidden w-64 shrink-0 flex-col bg-brand-gradient p-4 text-white lg:flex print:hidden">
          <div className="mb-6 flex items-center gap-3 px-1">
            <Logo className="h-10 w-10" />
            <div>
              <p className="font-display text-lg leading-tight">Diiamond</p>
              <p className="text-xs text-ouro-claro/80">painel da loja</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">{MENU.map((m) => item(m))}</nav>
          <div className="mt-auto space-y-2 pt-6">
            <a href="/" target="_blank" className="flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:bg-white/10"><IconeExterno /> Ver a loja</a>
            <button type="button" onClick={async () => { await api.logout(); navegar('/admin/login') }} className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 text-sm text-white/70 hover:bg-white/10">
              <IconeSair /> Sair
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-20 lg:pb-0">
          {/* Topo (celular) */}
          <header className="flex items-center gap-3 bg-brand-gradient px-4 py-3 text-white lg:hidden print:hidden">
            <Logo className="h-9 w-9" />
            <p className="flex-1 font-display text-lg">Painel Diiamond</p>
            <button type="button" onClick={() => setMenuAberto((v) => !v)} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm"><IconeMenu className="h-4.5 w-4.5" /> Mais</button>
          </header>
          {menuAberto && (
            <nav className="grid grid-cols-2 gap-1 bg-magenta p-3 lg:hidden print:hidden">
              {MENU.filter((m) => m.extra).map((m) => item(m))}
              <a href="/" target="_blank" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-white/70"><IconeExterno /> Ver a loja</a>
              <button type="button" onClick={async () => { await api.logout(); navegar('/admin/login') }} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-white/70"><IconeSair /> Sair</button>
            </nav>
          )}

          {MODO_DEMO && (
            <p className="bg-ambar-bg px-4 py-1.5 text-center text-xs font-medium text-ambar print:hidden">
              Modo demonstração: nada é salvo no servidor.{' '}
              <button type="button" className="underline" onClick={async () => { if (confirm('Apagar tudo e voltar aos dados de exemplo?')) { await api.resetarDemo(); location.reload() } }}>Restaurar exemplo</button>
            </p>
          )}
          {!alertasAtivos && !somDestravado() && (
            <div className="flex flex-wrap items-center justify-center gap-2 bg-ouro-palido px-4 py-2 text-center text-xs text-[#7a5f00] print:hidden">
              Toque para ouvir um alerta a cada pedido novo:
              <button type="button" onClick={ativarAlertas} className="inline-flex items-center gap-1.5 rounded-full bg-ouro px-3 py-1 font-semibold text-white"><IconeSino /> Ativar alertas</button>
            </div>
          )}

          <main className="mx-auto max-w-6xl p-4 sm:p-6">
            <Outlet />
          </main>
        </div>

        {/* Barra inferior (celular) */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-blush bg-white/95 backdrop-blur lg:hidden print:hidden">
          {MENU.filter((m) => !m.extra).map((m) => item(m, true))}
        </nav>
      </div>
    </PainelContext.Provider>
  )
}
