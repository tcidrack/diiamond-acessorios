import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { separarRuaNumero } from '../lib/geoapify.js'

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Bairros possíveis para o endereço digitado: com a casa exata no mapa, só o bairro dela; senão os bairros
 * onde a rua existe. Busca ~0,9 s depois de parar de digitar, guarda o que já buscou e nunca mostra a
 * resposta de um texto antigo (ex.: "Rua José" enquanto a cliente ainda digitava "Rua José Abílio").
 */
export function useBairrosSugeridos(endereco, ativo = true) {
  const [bairros, setBairros] = useState([])
  const cache = useRef(new Map())
  const { rua, numero } = separarRuaNumero(endereco)
  const chave = `${normalizar(rua)}|${numero}`
  useEffect(() => {
    setBairros([]) // texto mudou: some a lista anterior até chegar a nova
    if (!ativo || normalizar(rua).length < 4 || !/[a-z]{3}/.test(normalizar(rua))) return
    let vivo = true
    const t = setTimeout(() => {
      if (!cache.current.has(chave)) cache.current.set(chave, api.bairrosDoEndereco(endereco).catch(() => []))
      cache.current.get(chave).then((l) => vivo && setBairros(l || []))
    }, 900)
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
