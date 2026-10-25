import { useState } from 'react'
import { IconeDiamante } from './Icones.jsx'

/** Logo da loja (public/logo.webp). Se o arquivo faltar, mostra o brasão de diamante. */
export default function Logo({ className = 'h-12 w-12 sm:h-14 sm:w-14' }) {
  const [semLogo, setSemLogo] = useState(false)

  if (semLogo) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-ouro-claro/40 ${className}`}>
        <IconeDiamante className="h-3/5 w-3/5 text-ouro-claro" />
      </span>
    )
  }
  return (
    <img
      src="/logo.webp"
      alt="Diiamond Acessórios"
      onError={() => setSemLogo(true)}
      className={`shrink-0 rounded-2xl object-cover shadow-soft ring-1 ring-ouro-claro/50 ${className}`}
    />
  )
}
