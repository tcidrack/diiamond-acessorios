/** Ícones em traço fino, no mesmo desenho do diamante da Tabela de Preços. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconeDiamante({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M14 9h20l9 11-19 20L5 20z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M5 20h38M18 9l-4 11 10 20 10-20-4-11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity=".65" />
    </svg>
  )
}

export function IconeSacola({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </svg>
  )
}

export function IconeBusca({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
  )
}

export function IconeFechar({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconeLixo({ className = 'h-4.5 w-4.5' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" {...base} strokeWidth={1.4}>
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 011-1h2a1 1 0 011 1v1.5M5.5 5.5l.7 10a1.5 1.5 0 001.5 1.4h4.6a1.5 1.5 0 001.5-1.4l.7-10" />
    </svg>
  )
}

export function IconeWhatsApp({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  )
}

export function IconeInstagram({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
    </svg>
  )
}

export function IconeVoltar({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconeCheck({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} strokeWidth={2}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
