import { Outlet } from 'react-router-dom'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import CarrinhoDrawer from '../../components/CarrinhoDrawer.jsx'
import { useLoja } from '../../hooks/useLoja.jsx'
import { MODO_DEMO } from '../../lib/supabase.js'

export default function LojaLayout() {
  const { config } = useLoja()

  return (
    <div className="flex min-h-dvh flex-col">
      {MODO_DEMO && (
        <p className="bg-ambar-bg px-4 py-1.5 text-center text-xs font-medium text-ambar">
          Modo demonstração: os dados ficam só neste navegador. Configure o Supabase para usar de verdade.
        </p>
      )}
      {config?.banner_ativo && config.banner_texto && (
        <p className="bg-magenta px-4 py-2 text-center text-[13px] font-medium tracking-wide text-ouro-claro">
          ✦ {config.banner_texto} ✦
        </p>
      )}
      <Header />
      {config?.aberta === false && (
        <p className="bg-vermelho-bg px-4 py-2 text-center text-sm font-medium text-vermelho">
          Estamos fechadas para pedidos agora. Você pode olhar à vontade e voltar mais tarde 💖
        </p>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CarrinhoDrawer />
    </div>
  )
}
