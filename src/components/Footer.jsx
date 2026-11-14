import { IconeInstagram, IconeWhatsApp } from './Icones.jsx'
import { linkWhatsApp } from '../lib/format.js'
import { useLoja } from '../hooks/useLoja.jsx'
import { linhasHorarioEntrega } from '../lib/entrega.js'

export default function Footer() {
  const { config } = useLoja()
  if (!config) return null

  return (
    <footer className="mt-16 border-t border-blush bg-white/50">
      <span aria-hidden="true" className="fio-ouro block h-px" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-magenta/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg text-magenta">{config.nome}</p>
          {config.horario && <p>{config.horario}</p>}
          {config.endereco_retirada && <p>Retirada: {config.endereco_retirada}</p>}
          {linhasHorarioEntrega(config).length > 0 && (
            <p className="mt-1">Entregas: {linhasHorarioEntrega(config).join(' · ')}</p>
          )}
        </div>
        <div className="flex gap-2">
          {config.whatsapp && (
            <a href={linkWhatsApp(config.whatsapp, 'Olá! Vim pelo site 💖')} target="_blank" rel="noreferrer" className="btn-claro">
              <IconeWhatsApp /> WhatsApp
            </a>
          )}
          {config.instagram && (
            <a href={`https://instagram.com/${config.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="btn-claro">
              <IconeInstagram /> @{config.instagram.replace('@', '')}
            </a>
          )}
        </div>
      </div>
      <p className="pb-6 text-center text-[11px] font-medium tracking-wide text-magenta/55">
        Feito com ♥ por Thalison Cidrack ·{' '}
        <a href="https://instagram.com/cidrack.dev" target="_blank" rel="noreferrer" className="font-bold underline-offset-2 hover:underline">
          @cidrack.dev
        </a>
      </p>
    </footer>
  )
}
