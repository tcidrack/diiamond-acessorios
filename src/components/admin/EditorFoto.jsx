import { useCallback, useEffect, useRef, useState } from 'react'
import { carregarImagem, recortarImagem } from '../../lib/imagem.js'

const ZOOM_MAX = 4 // em relação ao "preencher"

/**
 * Editor de enquadramento: moldura quadrada (igual à loja), arrastar com o dedo/mouse,
 * pinça com dois dedos, roda do mouse e barra de zoom.
 * Medidas guardadas em frações da moldura (moldura = 1), então funciona em qualquer tamanho de tela.
 *
 * `fonte`: File ou URL. `onConfirmar(file)` pode ser assíncrono. `onPular` opcional (fila de fotos).
 */
export default function EditorFoto({ fonte, titulo = 'Ajustar foto', progresso, onConfirmar, onCancelar, onPular }) {
  const moldura = useRef(null)
  const ponteiros = useRef(new Map())
  const [img, setImg] = useState(null) // { el, url, w, h }
  const [pos, setPos] = useState(null) // { r, x, y }
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // carrega a foto (File ou URL)
  useEffect(() => {
    let ativo = true
    let urlTemp = null
    setImg(null)
    setPos(null)
    setErro('')
    const url = fonte instanceof Blob ? (urlTemp = URL.createObjectURL(fonte)) : fonte
    carregarImagem(url)
      .then((el) => {
        if (!ativo) return
        const w = el.naturalWidth
        const h = el.naturalHeight
        setImg({ el, url: el.src, w, h })
        setPos(centralizar(w, h, 1 / Math.min(w, h)))
      })
      .catch(() => ativo && setErro('Não foi possível abrir esta foto.'))
    return () => {
      ativo = false
      if (urlTemp) URL.revokeObjectURL(urlTemp)
    }
  }, [fonte])

  // trava a rolagem da página enquanto o editor está aberto
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = antes }
  }, [])

  const limites = img ? { min: 1 / Math.max(img.w, img.h), cobrir: 1 / Math.min(img.w, img.h) } : null

  // a foto nunca sai da moldura; se ficar menor que ela, fica centralizada naquele eixo
  const prender = useCallback((p) => {
    if (!img) return p
    const r = Math.min(Math.max(p.r, 1 / Math.max(img.w, img.h)), ZOOM_MAX / Math.min(img.w, img.h))
    const W = img.w * r
    const H = img.h * r
    const x = W >= 1 ? Math.min(0, Math.max(1 - W, p.x)) : (1 - W) / 2
    const y = H >= 1 ? Math.min(0, Math.max(1 - H, p.y)) : (1 - H) / 2
    return { r, x, y }
  }, [img])

  // zoom mantendo parado o ponto (px, py) da moldura
  const zoomEm = useCallback((fator, px = 0.5, py = 0.5) => {
    setPos((p) => {
      if (!p) return p
      const r = p.r * fator
      return prender({ r, x: px - (px - p.x) * (r / p.r), y: py - (py - p.y) * (r / p.r) })
    })
  }, [prender])

  // roda do mouse (precisa ser não-passivo para não rolar a página)
  useEffect(() => {
    const el = moldura.current
    if (!el) return
    const roda = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomEm(Math.exp(-e.deltaY * 0.0015), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [zoomEm, img])

  const relativo = (e) => {
    const rect = moldura.current.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const aoTocar = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    ponteiros.current.set(e.pointerId, relativo(e))
  }

  const aoMover = (e) => {
    const mapa = ponteiros.current
    if (!mapa.has(e.pointerId)) return
    const antes = [...mapa.values()]
    mapa.set(e.pointerId, relativo(e))
    const depois = [...mapa.values()]

    if (depois.length === 1) {
      const dx = depois[0].x - antes[0].x
      const dy = depois[0].y - antes[0].y
      setPos((p) => p && prender({ ...p, x: p.x + dx, y: p.y + dy }))
    } else if (depois.length >= 2) {
      const [a0, b0] = antes
      const [a1, b1] = depois
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y)
      const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
      if (!d0) return
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
      const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
      setPos((p) => {
        if (!p) return p
        const r = p.r * (d1 / d0)
        // aproxima em volta do meio dos dedos e acompanha o movimento deles
        return prender({ r, x: m1.x - (m0.x - p.x) * (r / p.r), y: m1.y - (m0.y - p.y) * (r / p.r) })
      })
    }
  }

  const aoSoltar = (e) => ponteiros.current.delete(e.pointerId)

  // barra de zoom em escala logarítmica: do "foto inteira" até 4× o "preencher"
  const maxR = limites ? ZOOM_MAX * limites.cobrir : 1
  const valorBarra = limites && pos ? Math.round((Math.log(pos.r / limites.min) / Math.log(maxR / limites.min)) * 1000) : 0
  const mudarBarra = (e) => {
    if (!limites || !pos) return
    const r = limites.min * Math.pow(maxR / limites.min, Number(e.target.value) / 1000)
    zoomEm(r / pos.r)
  }

  const usar = async () => {
    if (!img || !pos) return
    setSalvando(true)
    setErro('')
    try {
      const file = await recortarImagem(img.el, pos)
      await onConfirmar(file)
    } catch (e) {
      setErro(e?.name === 'SecurityError' ? 'Não foi possível ajustar esta foto. Apague e envie de novo.' : e.message || 'Não foi possível salvar a foto.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="pb-safe flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-magenta">{titulo}</h2>
          {progresso && <span className="text-xs font-medium text-magenta/50">{progresso}</span>}
        </div>

        <div
          ref={moldura}
          onPointerDown={aoTocar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          className="relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-2xl bg-white ring-1 ring-blush select-none active:cursor-grabbing"
        >
          {img && pos ? (
            <img
              src={img.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${img.w * pos.r * 100}%`, height: `${img.h * pos.r * 100}%` }}
            />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-magenta/40">{erro || 'Abrindo foto…'}</p>
          )}
          {/* linhas-guia (regra dos terços) */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => <span key={i} className="border border-white/40" />)}
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-magenta/50">Arraste para posicionar. Use dois dedos (ou a rodinha do mouse) para aproximar e afastar.</p>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-magenta/50" aria-hidden>−</span>
          <input type="range" min="0" max="1000" value={valorBarra} onChange={mudarBarra} disabled={!pos} aria-label="Zoom" className="flex-1 accent-magenta" />
          <span className="text-xs text-magenta/50" aria-hidden>+</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={!pos} onClick={() => setPos(centralizar(img.w, img.h, limites.cobrir))} className="btn-claro text-sm">Preencher</button>
          <button type="button" disabled={!pos} onClick={() => setPos(centralizar(img.w, img.h, limites.min))} className="btn-claro text-sm">Foto inteira</button>
        </div>

        {erro && pos && <p className="mt-3 rounded-xl bg-vermelho-bg/60 px-3 py-2 text-sm text-vermelho" role="alert">{erro}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancelar} disabled={salvando} className="btn-claro">Cancelar</button>
          {onPular && <button type="button" onClick={onPular} disabled={salvando} className="btn-claro">Pular</button>}
          <button type="button" onClick={usar} disabled={!pos || salvando} className="btn-primario flex-1">{salvando ? 'Salvando…' : 'Usar foto'}</button>
        </div>
      </div>
    </div>
  )
}

function centralizar(w, h, r) {
  return { r, x: (1 - w * r) / 2, y: (1 - h * r) / 2 }
}
