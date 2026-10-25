import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CarrinhoProvider } from './hooks/useCarrinho.jsx'
import { LojaProvider } from './hooks/useLoja.jsx'
import LojaLayout from './pages/loja/LojaLayout.jsx'
import Home from './pages/loja/Home.jsx'
import Produto from './pages/loja/Produto.jsx'
import Checkout from './pages/loja/Checkout.jsx'
import PedidoStatus from './pages/loja/PedidoStatus.jsx'

// o painel só é baixado por quem entra nele: a loja fica leve para o cliente
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const Login = lazy(() => import('./pages/admin/Login.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const Pedidos = lazy(() => import('./pages/admin/Pedidos.jsx'))
const PedidoDetalhe = lazy(() => import('./pages/admin/PedidoDetalhe.jsx'))
const Produtos = lazy(() => import('./pages/admin/Produtos.jsx'))
const ProdutoForm = lazy(() => import('./pages/admin/ProdutoForm.jsx'))
const Categorias = lazy(() => import('./pages/admin/Categorias.jsx'))
const Entrega = lazy(() => import('./pages/admin/Entrega.jsx'))
const Cupons = lazy(() => import('./pages/admin/Cupons.jsx'))
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes.jsx'))
const AssistenteIA = lazy(() => import('./pages/admin/AssistenteIA.jsx'))
const Conversas = lazy(() => import('./pages/admin/Conversas.jsx'))

function Carregando() {
  return <div className="flex min-h-dvh items-center justify-center text-magenta/40">Carregando…</div>
}

export default function App() {
  return (
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
  )
}
