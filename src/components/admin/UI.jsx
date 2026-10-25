import { useEffect, useState } from 'react'

export function Titulo({ children, acao }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-semibold text-magenta sm:text-3xl">{children}</h1>
      {acao}
    </div>
  )
}

export function Toggle({ ativo, onChange, rotulo, disabled }) {
  return (
    <label className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 ${disabled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        disabled={disabled}
        onClick={() => onChange(!ativo)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${ativo ? 'bg-magenta' : 'bg-magenta/20'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-5' : ''}`} />
      </button>
      {rotulo && <span className="text-sm text-[#3d2430]">{rotulo}</span>}
    </label>
  )
}

export function Campo({ rotulo, ajuda, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo">{rotulo}</span>
      {children}
      {ajuda && <span className="mt-1 block text-xs text-magenta/45">{ajuda}</span>}
    </label>
  )
}

export function Vazio({ children }) {
  return <p className="card p-8 text-center text-sm text-magenta/50">{children}</p>
}

export function Erro({ children }) {
  if (!children) return null
  return <p role="alert" className="rounded-xl bg-vermelho-bg/60 px-3 py-2 text-sm text-vermelho">{children}</p>
}

/** Mensagem curta que some sozinha ("Salvo!"). */
export function useAviso() {
  const [aviso, setAviso] = useState(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2800)
    return () => clearTimeout(t)
  }, [aviso])
  const elemento = aviso ? (
    <div role="status" className="surge fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-magenta px-5 py-2.5 text-sm font-medium text-white shadow-lift lg:bottom-6">
      {aviso}
    </div>
  ) : null
  return [elemento, setAviso]
}
