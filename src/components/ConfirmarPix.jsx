import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatBRL } from '../lib/format.js'
import { IconeCheck } from './Icones.jsx'

/** Depois de pagar no app do banco, a cliente confirma aqui que já fez o Pix (sem enviar arquivo). */
export default function ConfirmarPix({ codigo, token, valor, recebedor, jaInformado, onInformado }) {
  const [etapa, setEtapa] = useState(jaInformado ? 'ok' : 'pergunta') // pergunta | confirmar | ok
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const confirmar = async () => {
    setEnviando(true)
    setErro('')
    try {
      await api.informarPixEnviado(codigo, token)
      setEtapa('ok')
      onInformado?.()
    } catch {
      setErro('Não deu para registrar agora. Avise a loja pelo WhatsApp abaixo que já pagou.')
    } finally {
      setEnviando(false)
    }
  }

  if (etapa === 'ok' || jaInformado) {
    return (
      <div className="card flex items-center gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-verde-bg text-verde"><IconeCheck /></span>
        <div>
          <p className="font-semibold text-verde">Pagamento informado!</p>
          <p className="text-xs text-magenta/55">A loja vai conferir no banco e confirmar seu pedido.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      {etapa === 'pergunta' ? (
        <>
          <p className="font-semibold text-magenta">Já fez o Pix?</p>
          <p className="mt-0.5 text-xs text-magenta/55">Depois de pagar no app do banco, toque aqui para avisar que o pagamento foi feito.</p>
          <button type="button" onClick={() => setEtapa('confirmar')} className="btn-primario mt-3 w-full">Já fiz o Pix</button>
        </>
      ) : (
        <>
          <p className="font-semibold text-magenta">Confirma o pagamento?</p>
          <p className="mt-1 text-sm text-magenta/70">
            Você enviou <strong className="tnum">{formatBRL(valor)}</strong>{recebedor ? <> para <strong>{recebedor}</strong></> : null}?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEtapa('pergunta')} disabled={enviando} className="btn-claro">Ainda não</button>
            <button type="button" onClick={confirmar} disabled={enviando} className="btn-primario">{enviando ? 'Enviando…' : 'Sim, já paguei'}</button>
          </div>
        </>
      )}
      {erro && <p className="mt-2 text-sm text-vermelho">{erro}</p>}
    </div>
  )
}
