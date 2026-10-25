import { useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { comprimirImagem } from '../lib/imagem.js'
import { IconeCheck } from './Icones.jsx'

export default function EnviarComprovante({ codigo, token, jaEnviado, onEnviado }) {
  const input = useRef(null)
  const [estado, setEstado] = useState(jaEnviado ? 'ok' : 'livre')
  const [erro, setErro] = useState('')

  const enviar = async (e) => {
    const original = e.target.files?.[0]
    e.target.value = ''
    if (!original) return
    if (original.size > 15 * 1024 * 1024) return setErro('Arquivo muito grande. Envie um print ou foto do comprovante.')
    setErro('')
    setEstado('enviando')
    try {
      const arquivo = original.type === 'application/pdf' ? original : await comprimirImagem(original, { max: 1600, qualidade: 0.8 })
      if (arquivo.size > 5 * 1024 * 1024) throw new Error('Arquivo muito grande (máx. 5 MB).')
      await api.enviarComprovante(codigo, token, arquivo)
      setEstado('ok')
      onEnviado?.()
    } catch (err) {
      setErro(err.message)
      setEstado('livre')
    }
  }

  return (
    <div className="card p-5">
      <input ref={input} type="file" accept="image/*,application/pdf" onChange={enviar} className="hidden" />
      {estado === 'ok' ? (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verde-bg text-verde"><IconeCheck /></span>
          <div className="flex-1">
            <p className="font-semibold text-verde">Comprovante enviado!</p>
            <p className="text-xs text-magenta/55">A loja vai conferir e confirmar seu pagamento.</p>
          </div>
          <button type="button" onClick={() => input.current.click()} className="text-xs font-medium text-magenta/60 underline">trocar</button>
        </div>
      ) : (
        <>
          <p className="font-semibold text-magenta">Já pagou? Envie o comprovante</p>
          <p className="mt-0.5 text-xs text-magenta/55">Print da tela do banco ou PDF. Assim a loja já separa seu pedido.</p>
          <button type="button" disabled={estado === 'enviando'} onClick={() => input.current.click()} className="btn-primario mt-3 w-full">
            {estado === 'enviando' ? 'Enviando…' : 'Enviar comprovante'}
          </button>
        </>
      )}
      {erro && <p className="mt-2 text-sm text-vermelho">{erro}</p>}
    </div>
  )
}
