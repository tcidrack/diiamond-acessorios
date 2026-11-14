import { useState } from 'react'
import { Link } from 'react-router-dom'
import BolinhasCor from './BolinhasCor.jsx'
import Preco from './Preco.jsx'
import { IconeDiamante, IconeSacola } from './Icones.jsx'
import { esgotado, percentualDesconto, variantesDe } from '../lib/precos.js'
import { useCarrinho } from '../hooks/useCarrinho.jsx'
import { useLoja } from '../hooks/useLoja.jsx'

export default function ProductCard({ produto: original }) {
  const { adicionar } = useCarrinho()
  const { config, produtos } = useLoja()
  // tocar numa bolinha de cor troca o card para aquela cor, sem sair do lugar
  const variantes = variantesDe(original, produtos)
  const [selecionadoId, setSelecionadoId] = useState(original.id)
  const produto = variantes.find((v) => v.id === selecionadoId) || original
  const off = percentualDesconto(produto)
  const semEstoque = esgotado(produto)
  const poucas = config?.mostrar_ultimas !== false && !semEstoque && produto.estoque !== null && produto.estoque <= 3
  const foto = produto.imagens?.[0]?.url

  return (
    <article className="surge group card relative flex flex-col overflow-hidden transition duration-300 hover:shadow-lift">
      <Link to={`/produto/${produto.slug || produto.id}`} className="relative block aspect-square overflow-hidden bg-cream">
        {foto ? (
          <img
            src={foto}
            alt={produto.nome}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${semEstoque ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <IconeDiamante className="h-14 w-14 text-ouro-claro" />
          </span>
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {off > 0 && !semEstoque && (
            <span className="rounded-full bg-magenta px-2.5 py-1 text-[11px] font-bold text-white shadow-soft">-{off}%</span>
          )}
          {semEstoque && (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-magenta/70 uppercase">Esgotado</span>
          )}
          {poucas && (
            <span className="rounded-full bg-ouro-palido px-2.5 py-1 text-[11px] font-semibold text-[#7a5f00] ring-1 ring-ouro/30">
              Últimas {produto.estoque}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {produto.material && (
          <p className="truncate text-[11px] font-medium tracking-wide text-ouro uppercase">{produto.material}</p>
        )}
        <Link to={`/produto/${produto.slug || produto.id}`} className="line-clamp-2 font-display text-[15px] leading-snug font-semibold text-magenta sm:text-base">
          {produto.nome}
        </Link>
        {variantes.length > 1 && (
          <BolinhasCor opcoes={variantes} atualId={produto.id} onEscolher={(v) => setSelecionadoId(v.id)} />
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Preco produto={produto} />
          <button
            type="button"
            disabled={semEstoque}
            onClick={() => adicionar(produto)}
            aria-label={`Adicionar ${produto.nome} ao carrinho`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blush/70 text-magenta transition hover:bg-magenta hover:text-white active:scale-90 disabled:opacity-30"
          >
            <IconeSacola className="h-5 w-5" />
          </button>
        </div>
      </div>
    </article>
  )
}
