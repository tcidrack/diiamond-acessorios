import { useEffect, useState } from 'react'

const INTERVALO = 4000

/** Lista de textos dos banners (aceita a faixa antiga, de um texto só, se a SQL 0012 ainda não rodou). */
export function textosBanners(config) {
  if (!config?.banner_ativo) return []
  const lista = Array.isArray(config.banners) && config.banners.length ? config.banners : [config.banner_texto]
  return lista.map((t) => String(t || '').trim()).filter(Boolean)
}

/** Faixa do topo: mostra um aviso por vez e passa para o próximo sozinha (pausa ao tocar/passar o mouse). */
export default function BannerRotativo({ textos }) {
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)
  const n = textos.length

  useEffect(() => {
    if (atual >= n) setAtual(0)
  }, [n, atual])

  useEffect(() => {
    if (n < 2 || pausado) return
    const t = setInterval(() => setAtual((i) => (i + 1) % n), INTERVALO)
    return () => clearInterval(t)
  }, [n, pausado])

  if (!n) return null

  return (
    <div
      className="relative bg-magenta px-8 py-2 text-center text-[13px] font-medium tracking-wide text-ouro-claro"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      aria-roledescription="carrossel"
    >
      <div className="grid">
        {textos.map((t, i) => (
          <p
            key={i}
            aria-hidden={i !== atual}
            className={`col-start-1 row-start-1 transition-all duration-500 motion-reduce:transition-none ${i === atual ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`}
          >
            ✦ {t} ✦
          </p>
        ))}
      </div>
      {n > 1 && (
        <div className="mt-1 flex justify-center gap-1.5">
          {textos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Aviso ${i + 1} de ${n}`}
              onClick={() => setAtual(i)}
              className={`h-1.5 rounded-full transition-all ${i === atual ? 'w-4 bg-ouro-claro' : 'w-1.5 bg-ouro-claro/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
