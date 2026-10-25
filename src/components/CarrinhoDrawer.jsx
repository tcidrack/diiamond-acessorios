import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Quantidade from './Quantidade.jsx'
import { IconeDiamante, IconeFechar, IconeLixo, IconeSacola } from './Icones.jsx'
import { formatBRL } from '../lib/format.js'
import { useCarrinho } from '../hooks/useCarrinho.jsx'
import { useLoja } from '../hooks/useLoja.jsx'

export default function CarrinhoDrawer() {
  const { itens, subtotal, aberto, setAberto, alterarQuantidade, remover, sincronizar } = useCarrinho()
  const { produtos, config } = useLoja()
  const navegar = useNavigate()

  useEffect(() => {
    if (produtos.length) sincronizar(produtos)
  }, [produtos, sincronizar])

  useEffect(() => {
    if (!aberto) return
    const esc = (e) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aberto, setAberto])

  const minimo = Number(config?.pedido_minimo || 0)
  const faltaMinimo = minimo > 0 && subtotal < minimo

  return (
    <div className={`fixed inset-0 z-50 ${aberto ? '' : 'pointer-events-none'}`} aria-hidden={!aberto}>
      <div
        onClick={() => setAberto(false)}
        className={`absolute inset-0 bg-magenta/30 backdrop-blur-sm transition-opacity duration-300 ${aberto ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-label="Carrinho"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-cream shadow-lift transition-transform duration-300 ${aberto ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-blush px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-magenta">
            <IconeSacola className="h-5 w-5 text-ouro" /> Seu carrinho
          </h2>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar carrinho" className="flex h-11 w-11 items-center justify-center rounded-xl text-magenta/60 hover:bg-blush/60">
            <IconeFechar />
          </button>
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <IconeDiamante className="h-14 w-14 text-ouro-claro" />
            <p className="font-display text-lg text-magenta">Seu carrinho está vazio</p>
            <button type="button" onClick={() => setAberto(false)} className="btn-claro">Ver produtos</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto p-4">
              {itens.map((item) => (
                <li key={item.produto_id} className="card flex gap-3 p-3">
                  <Link to={`/produto/${item.slug || item.produto_id}`} onClick={() => setAberto(false)} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white">
                    {item.imagem ? <img src={item.imagem} alt="" className="h-full w-full object-cover" /> : <IconeDiamante className="m-5 h-10 w-10 text-ouro-claro" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 flex-1 text-sm font-semibold text-magenta">{item.nome}</p>
                      <button type="button" onClick={() => remover(item.produto_id)} aria-label={`Remover ${item.nome}`} className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-magenta/30 hover:bg-vermelho-bg/60 hover:text-vermelho">
                        <IconeLixo />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <Quantidade pequeno valor={item.quantidade} max={item.estoque ?? 50} onChange={(q) => alterarQuantidade(item.produto_id, q)} />
                      <span className="tnum text-sm font-bold text-magenta">{formatBRL(item.preco * item.quantidade)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="pb-safe space-y-3 border-t border-blush bg-white/70 px-5 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-magenta/60">Subtotal</span>
                <span className="tnum text-xl font-bold text-magenta">{formatBRL(subtotal)}</span>
              </div>
              <p className="text-xs text-magenta/45">Entrega e cupom são calculados na próxima etapa.</p>
              {faltaMinimo && (
                <p className="rounded-xl bg-ambar-bg px-3 py-2 text-xs font-medium text-ambar">
                  Pedido mínimo de {formatBRL(minimo)}. Faltam {formatBRL(minimo - subtotal)}.
                </p>
              )}
              <button
                type="button"
                disabled={faltaMinimo || config?.aberta === false}
                onClick={() => {
                  setAberto(false)
                  navegar('/checkout')
                }}
                className="btn-primario w-full text-base"
              >
                {config?.aberta === false ? 'Loja fechada no momento' : 'Finalizar pedido'}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
