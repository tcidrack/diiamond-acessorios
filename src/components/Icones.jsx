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

/* ---- Painel ---- */
function Traco({ className, children, strokeWidth }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} strokeWidth={strokeWidth ?? base.strokeWidth}>
      {children}
    </svg>
  )
}

export const IconeInicio = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z" /></Traco>
)
export const IconePedidos = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M6 3.5h12a1 1 0 011 1V20l-2.5-1.5L14 20l-2-1.5L10 20l-2.5-1.5L5 20V4.5a1 1 0 011-1z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </Traco>
)
export const IconeProdutos = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M7.5 4.5h9l4 5L12 20 3.5 9.5z" />
    <path d="M3.5 9.5h17M10 4.5l-1.5 5L12 20l3.5-10.5-1.5-5" />
  </Traco>
)
export const IconeMensagem = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M20 11.5a7.5 7.5 0 01-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1120 11.5z" />
    <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" strokeWidth={2.4} />
  </Traco>
)
export const IconeBrilho = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M11 3.5l1.6 4.4a2 2 0 001.2 1.2L18.2 10.7l-4.4 1.6a2 2 0 00-1.2 1.2L11 17.9l-1.6-4.4a2 2 0 00-1.2-1.2L3.8 10.7l4.4-1.6a2 2 0 001.2-1.2z" />
    <path d="M18.5 15.5v4M16.5 17.5h4" />
  </Traco>
)
export const IconeCategorias = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
  </Traco>
)
export const IconeEntrega = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M3 6.5a1 1 0 011-1h9.5a1 1 0 011 1v9.5H3z" />
    <path d="M14.5 9.5h3.2l3.3 3.6V16h-6.5" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Traco>
)
export const IconeCupom = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M4 7a1.5 1.5 0 011.5-1.5h13A1.5 1.5 0 0120 7v2.5a2.5 2.5 0 000 5V17a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17v-2.5a2.5 2.5 0 000-5z" />
    <path d="M9.5 14.5l5-5M9.75 9.75h.01M14.25 14.25h.01" />
  </Traco>
)
export const IconeAjustes = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Traco>
)
export const IconeExterno = ({ className = 'h-4.5 w-4.5' }) => (
  <Traco className={className}><path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1 1 0 01-1 1H5.5a1 1 0 01-1-1V8a1 1 0 011-1H10" /></Traco>
)
export const IconeSair = ({ className = 'h-4.5 w-4.5' }) => (
  <Traco className={className}><path d="M10 4.5H5.5a1 1 0 00-1 1v13a1 1 0 001 1H10M15 8l4 4-4 4M19 12H9.5" /></Traco>
)
export const IconeSeta = ({ className = 'h-4 w-4' }) => (
  <Traco className={className}><path d="M6 9.5l6 6 6-6" /></Traco>
)
export const IconeMenu = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}><path d="M4 7h16M4 12h16M4 17h10" /></Traco>
)
export const IconeSino = ({ className = 'h-4 w-4' }) => (
  <Traco className={className}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 004 0" /></Traco>
)
export const IconeMicrofone = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5" />
  </Traco>
)
export const IconeParar = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /></svg>
)
export const IconeClipe = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}><path d="M19 11.5l-7 7a4.5 4.5 0 01-6.4-6.4l7.6-7.6a3 3 0 014.2 4.2l-7.6 7.6a1.5 1.5 0 01-2.1-2.1l7-7" /></Traco>
)
export const IconeRaio = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d="M13.5 2.5L4.5 14h6.5l-1 7.5 9-11.5h-6.5z" /></svg>
)
export const IconeBaixar = ({ className = 'h-4.5 w-4.5' }) => (
  <Traco className={className}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" /></Traco>
)
export const IconeImpressora = ({ className = 'h-4.5 w-4.5' }) => (
  <Traco className={className}>
    <path d="M7 8V4.5h10V8M7 17H5a1 1 0 01-1-1v-6a2 2 0 012-2h12a2 2 0 012 2v6a1 1 0 01-1 1h-2" />
    <path d="M7 13.5h10v6H7z" />
  </Traco>
)
export const IconeArrastar = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    {[8, 16].flatMap((x) => [6, 12, 18].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
  </svg>
)
export const IconeOlho = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Traco>
)
export const IconeOlhoFechado = ({ className = 'h-5 w-5' }) => (
  <Traco className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </Traco>
)
export const IconeEstrela = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
)

export function IconeCheck({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} strokeWidth={2}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
