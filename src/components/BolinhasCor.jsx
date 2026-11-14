import { Link } from 'react-router-dom'
import { esgotado, fundoBolinha } from '../lib/precos.js'

/**
 * Bolinhas com as cores do mesmo modelo.
 * Com `onEscolher`, tocar troca na hora (card); sem ele, cada bolinha é um link (página do produto).
 */
export default function BolinhasCor({ opcoes, atualId, onEscolher, max = 5, grande = false }) {
  if (!opcoes || opcoes.length < 2) return null
  const visiveis = opcoes.length > max ? opcoes.slice(0, max - 1) : opcoes
  const resto = opcoes.length - visiveis.length
  // a selecionada sempre aparece, mesmo se estiver depois do limite
  if (resto && !visiveis.some((o) => o.id === atualId)) visiveis[visiveis.length - 1] = opcoes.find((o) => o.id === atualId)

  const tamanho = grande ? 'h-8 w-8' : 'h-5 w-5'
  const area = grande ? 'h-11 w-11' : 'h-8 w-8'

  return (
    <div className="-mx-1.5 flex flex-wrap items-center" role="group" aria-label="Outras cores">
      {visiveis.map((o) => {
        const ativa = o.id === atualId
        const rotulo = o.cor_nome || o.nome
        const bolinha = (
          <span
            className={`relative block ${tamanho} overflow-hidden rounded-full ring-1 ring-black/10 transition ${ativa ? 'outline-2 outline-offset-2 outline-magenta' : ''}`}
            style={fundoBolinha(o)}
          >
            {esgotado(o) && <span className="absolute inset-0 m-auto h-[140%] w-px rotate-45 bg-magenta/70" />}
          </span>
        )
        const comum = {
          title: esgotado(o) ? `${rotulo} (esgotado)` : rotulo,
          'aria-label': esgotado(o) ? `${rotulo}, esgotado` : rotulo,
          'aria-pressed': onEscolher ? ativa : undefined,
          'aria-current': !onEscolher && ativa ? 'true' : undefined,
          className: `flex ${area} items-center justify-center rounded-full`,
        }
        return onEscolher ? (
          <button key={o.id} type="button" {...comum} onClick={(e) => { e.preventDefault(); onEscolher(o) }}>{bolinha}</button>
        ) : (
          <Link key={o.id} {...comum} to={`/produto/${o.slug || o.id}`} replace>{bolinha}</Link>
        )
      })}
      {resto > 0 && <span className="px-1 text-[11px] font-medium text-magenta/50">+{resto}</span>}
    </div>
  )
}
