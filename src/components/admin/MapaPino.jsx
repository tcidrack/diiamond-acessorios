import { useEffect, useRef } from 'react'

/**
 * Mapinha (OpenStreetMap) com um pino arrastável. `ponto` = { lat, lng }; `onMover({ lat, lng })`
 * é chamado quando a dona solta o pino ou toca no mapa. O Leaflet só é carregado aqui (painel).
 */
export default function MapaPino({ ponto, onMover, altura = 240 }) {
  const caixa = useRef(null)
  const mapa = useRef(null)
  const pino = useRef(null)
  const mover = useRef(onMover)
  mover.current = onMover

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      if (!vivo || !caixa.current || mapa.current) return
      const m = L.map(caixa.current, { zoomControl: true, attributionControl: true }).setView([ponto.lat, ponto.lng], 18)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
      const icone = L.divIcon({
        className: '',
        html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#9d174d;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })
      const p = L.marker([ponto.lat, ponto.lng], { draggable: true, icon: icone }).addTo(m)
      const avisar = (ll) => mover.current?.({ lat: Math.round(ll.lat * 1e6) / 1e6, lng: Math.round(ll.lng * 1e6) / 1e6 })
      p.on('dragend', () => avisar(p.getLatLng()))
      m.on('click', (e) => { p.setLatLng(e.latlng); avisar(e.latlng) })
      mapa.current = m
      pino.current = p
    })()
    return () => {
      vivo = false
      mapa.current?.remove()
      mapa.current = null
      pino.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ponto mudou por fora (nova busca): leva o pino e o mapa até lá
  useEffect(() => {
    const p = pino.current
    if (!p || ponto?.lat == null) return
    const atual = p.getLatLng()
    if (Math.abs(atual.lat - ponto.lat) > 1e-6 || Math.abs(atual.lng - ponto.lng) > 1e-6) {
      p.setLatLng([ponto.lat, ponto.lng])
      mapa.current.setView([ponto.lat, ponto.lng], 18)
    }
  }, [ponto?.lat, ponto?.lng])

  return <div ref={caixa} style={{ height: altura }} className="relative z-0 w-full overflow-hidden rounded-2xl border border-magenta/10" />
}
