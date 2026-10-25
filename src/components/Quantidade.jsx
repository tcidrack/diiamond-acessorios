export default function Quantidade({ valor, onChange, max = 50, pequeno = false }) {
  const tam = pequeno ? 'h-9 w-9' : 'h-11 w-11'
  return (
    <div className="inline-flex items-center rounded-xl bg-cream ring-1 ring-blush">
      <button type="button" onClick={() => onChange(valor - 1)} aria-label="Diminuir" className={`${tam} text-lg text-magenta/70 transition hover:text-magenta`}>
        −
      </button>
      <span className="tnum min-w-7 text-center text-sm font-semibold text-magenta" aria-live="polite">{valor}</span>
      <button
        type="button"
        onClick={() => onChange(valor + 1)}
        disabled={valor >= max}
        aria-label="Aumentar"
        className={`${tam} text-lg text-magenta/70 transition hover:text-magenta disabled:opacity-30`}
      >
        +
      </button>
    </div>
  )
}
