import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { gerarPixCopiaECola } from '../lib/pix.js'
import { formatBRL } from '../lib/format.js'
import { IconeCheck } from './Icones.jsx'

export default function PixPagamento({ config, valor, codigo }) {
  const [qr, setQr] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const configurado = !!config?.chave_pix

  const payload = configurado
    ? gerarPixCopiaECola({ chave: config.chave_pix, nome: config.pix_nome || config.nome, cidade: config.pix_cidade, valor, txid: codigo })
    : ''

  useEffect(() => {
    if (!payload) return
    QRCode.toDataURL(payload, { margin: 1, width: 360, color: { dark: '#3d2430', light: '#ffffff' } }).then(setQr)
  }, [payload])

  if (!configurado) {
    return <p className="rounded-2xl bg-ambar-bg p-4 text-sm text-ambar">A chave Pix da loja ainda não foi cadastrada. Chame a loja no WhatsApp para combinar o pagamento.</p>
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      // navegador sem permissão de área de transferência: seleciona o texto para copiar à mão
      document.getElementById('pix-copia-cola')?.select()
      return
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="borda-ouro rounded-3xl border bg-ouro-palido p-5 shadow-ouro">
      <p className="text-center text-sm text-magenta/70">Pague com Pix</p>
      <p className="tnum text-center text-3xl font-bold text-magenta">{formatBRL(valor)}</p>
      {qr && <img src={qr} alt="QR Code Pix" className="mx-auto mt-4 h-52 w-52 rounded-2xl bg-white p-2 shadow-soft" />}
      <p className="mt-4 text-center text-xs text-magenta/60">Abra o app do seu banco, escolha Pix e leia o QR Code, ou use o copia e cola:</p>
      <textarea id="pix-copia-cola" readOnly value={payload} rows={3} className="campo mt-2 resize-none font-mono text-[11px] leading-snug break-all" onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copiar} className="btn-ouro mt-2 w-full">
        {copiado ? <><IconeCheck /> Copiado!</> : 'Copiar código Pix'}
      </button>
      <p className="mt-3 text-center text-xs text-magenta/50">
        Recebedor: {config.pix_nome || config.nome} · Chave: {config.chave_pix}
      </p>
    </div>
  )
}
