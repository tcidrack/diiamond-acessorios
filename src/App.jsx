import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ErroTela, { lazyComRecarga } from './components/ErroTela.jsx'
import { CarrinhoProvider } from './hooks/useCarrinho.jsx'
import { LojaProvider } from './hooks/useLoja.jsx'
import LojaLayout from './pages/loja/LojaLayout.jsx'
import Home from './pages/loja/Home.jsx'
import Produto from './pages/loja/Produto.jsx'
import Checkout from './pages/loja/Checkout.jsx'
import PedidoStatus from './pages/loja/PedidoStatus.jsx'

// o painel só é baixado por quem entra nele: a loja fica leve para o cliente
const AdminLayout = lazyComRecarga(() => import('./pages/admin/AdminLayout.jsx'))
const Login = lazyComRecarga(() => import('./pages/admin/Login.jsx'))
const Dashboard = lazyComRecarga(() => import('./pages/admin/Dashboard.jsx'))
const Pedidos = lazyComRecarga(() => import('./pages/admin/Pedidos.jsx'))
const PedidoDetalhe = lazyComRecarga(() => import('./pages/admin/PedidoDetalhe.jsx'))
const Produtos = lazyComRecarga(() => import('./pages/admin/Produtos.jsx'))
const ProdutoForm = lazyComRecarga(() => import('./pages/admin/ProdutoForm.jsx'))
const Categorias = lazyComRecarga(() => import('./pages/admin/Categorias.jsx'))
const Entrega = lazyComRecarga(() => import('./pages/admin/Entrega.jsx'))
const Cupons = lazyComRecarga(() => import('./pages/admin/Cupons.jsx'))
const Configuracoes = lazyComRecarga(() => import('./pages/admin/Configuracoes.jsx'))
const AssistenteIA = lazyComRecarga(() => import('./pages/admin/AssistenteIA.jsx'))
const Conversas = lazyComRecarga(() => import('./pages/admin/Conversas.jsx'))

function Carregando() {
  return <div className="flex min-h-dvh items-center justify-center text-magenta/40">Carregando…</div>
}

export default function App() {
  return (
    <ErroTela>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route
            element={
              <LojaProvider>
                <CarrinhoProvider>
                  <LojaLayout />
                </CarrinhoProvider>
              </LojaProvider>
            }
          >
            <Route index element={<Home />} />
            <Route path="produto/:slug" element={<Produto />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pedido/:codigo" element={<PedidoStatus />} />
          </Route>

          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="pedidos/:id" element={<PedidoDetalhe />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="produtos/:id" element={<ProdutoForm />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="entrega" element={<Entrega />} />
            <Route path="cupons" element={<Cupons />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="assistente" element={<AssistenteIA />} />
            <Route path="conversas" element={<Conversas />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErroTela>
  )
}
