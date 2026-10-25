import { formatBRL } from '../lib/format.js'
import { emPromocao, precoFinal } from '../lib/precos.js'

export default function Preco({ produto, grande = false }) {
  const promo = emPromocao(produto)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {promo && (
        <span className={`tnum text-magenta/40 line-through ${grande ? 'text-base' : 'text-xs'}`}>
          {formatBRL(produto.preco)}
        </span>
      )}
      <span className={`tnum font-bold text-magenta ${grande ? 'text-3xl' : 'text-lg'}`}>
        {formatBRL(precoFinal(produto))}
      </span>
    </div>
  )
}
