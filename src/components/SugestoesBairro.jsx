import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { separarRuaNumero } from '../lib/geoapify.js'

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Bairros onde existe a rua digitada (busca ~0,7 s depois de parar de digitar; guarda o que já buscou). */
export function useBairrosSugeridos(endereco, ativo = true) {
  const [bairros, setBairros] = useState([])
  const cache = useRef(new Map())
  // só a rua importa (o número não muda o bairro): "Rua Luminosa, 2073" e "Rua Luminosa 10" = mesma busca
  const { rua } = separarRuaNumero(endereco)
  const chave = normalizar(rua)
  useEffect(() => {
    if (!ativo || chave.length < 4 || !/[a-z]{3}/.test(chave)) {
      setBairros([])
      return
    }
    if (cache.current.has(chave)) {
      cache.current.get(chave).then(setBairros)
      return
    }
    let vivo = true
    const t = setTimeout(() => {
      const p = api.bairrosDoEndereco(endereco).catch(() => [])
      cache.current.set(chave, p)
      p.then((l) => vivo && setBairros(l || []))
    }, 700)
    return () => { vivo = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, chave])
  return bairros
}

/** "Seu bairro é um destes?" + botões; tocar preenche o bairro. */
export default function SugestoesBairro({ opcoes, valor, onEscolher, titulo = 'Seu bairro é um destes? Toque para escolher:' }) {
  if (!opcoes?.length) return null
  const atual = normalizar(valor)
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs text-magenta/55">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((b) => {
          const escolhido = normalizar(b) === atual
          return (
            <button
              key={b}
              type="button"
              onClick={() => onEscolher(b)}
              aria-pressed={escolhido}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${escolhido ? 'border-magenta bg-magenta text-white' : 'border-blush bg-white text-magenta hover:border-magenta/50'}`}
            >
              {b}
            </button>
          )
        })}
      </div>
    </div>
  )
}
