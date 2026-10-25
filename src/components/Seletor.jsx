import { useEffect, useId, useRef, useState } from 'react'

/**
 * Menu suspenso no estilo da loja (substitui o <select>, cuja lista o navegador não deixa estilizar).
 * opcoes: [{ valor, rotulo }]
 */
export default function Seletor({ valor, opcoes, onChange, 'aria-label': rotulo }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const raiz = useRef(null)
  const botao = useRef(null)
  const lista = useRef(null)
  const id = useId()
  const atual = opcoes.find((o) => o.valor === valor) || opcoes[0]

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false) }
    document.addEventListener('pointerdown', fora)
    lista.current?.focus()
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])

  const abrir = () => {
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === atual?.valor)))
    setAberto(true)
  }
  const fechar = () => {
    setAberto(false)
    botao.current?.focus()
  }
  const escolher = (o) => {
    onChange(o.valor)
    fechar()
  }

  const teclaBotao = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      abrir()
    }
  }
  const teclaLista = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, opcoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setAtivo(0) }
    else if (e.key === 'End') { e.preventDefault(); setAtivo(opcoes.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(opcoes[ativo]) }
    else if (e.key === 'Escape') { e.preventDefault(); fechar() }
    else if (e.key === 'Tab') setAberto(false)
  }

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={rotulo}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclaBotao}
        className={`seletor text-left ${aberto ? 'border-ouro-claro ring-2 ring-ouro-claro/40' : ''}`}
      >
        {atual?.rotulo}
      </button>
      {aberto && (
        <ul
          ref={lista}
          role="listbox"
          tabIndex={-1}
          aria-label={rotulo}
          aria-activedescendant={`${id}-${ativo}`}
          onKeyDown={teclaLista}
          className="seletor-lista absolute top-full left-0 z-30 mt-2 min-w-full overflow-hidden rounded-2xl bg-white p-1.5 shadow-soft ring-1 ring-blush focus:outline-none"
        >
          {opcoes.map((o, i) => {
            const escolhido = o.valor === atual?.valor
            return (
              <li
                key={o.valor}
                id={`${id}-${i}`}
                role="option"
                aria-selected={escolhido}
                onPointerEnter={() => setAtivo(i)}
                onClick={() => escolher(o)}
                className={`flex min-h-[40px] cursor-pointer items-center justify-between gap-4 rounded-xl px-3 text-[15px] whitespace-nowrap transition-colors ${
                  i === ativo ? 'bg-blush/50' : ''
                } ${escolhido ? 'font-semibold text-magenta' : 'text-[#3d2430]'}`}
              >
                {o.rotulo}
                <span aria-hidden="true" className={`text-ouro ${escolhido ? '' : 'invisible'}`}>✓</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
