/**
 * Gera o "Pix copia e cola" (BR Code / EMV) com valor fixo.
 * Padrão do Banco Central: ID + tamanho (2 dígitos) + valor, com CRC16-CCITT no final.
 */
function campo(id, valor) {
  const v = String(valor)
  return id + String(v.length).padStart(2, '0') + v
}

function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Remove acento e símbolo: o padrão só aceita ASCII nos campos de nome/cidade. */
function limpar(texto, max) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max)
}

/** Telefone vira +55..., e-mail e chave aleatória vão como estão, CPF/CNPJ só dígitos. */
export function normalizarChavePix(chave) {
  const c = String(chave || '').trim()
  if (c.includes('@') || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c)) return c
  const digitos = c.replace(/\D/g, '')
  if (c.startsWith('+')) return '+' + digitos
  if (digitos.length === 13 && digitos.startsWith('55')) return '+' + digitos
  // 11 dígitos é ambíguo (CPF ou celular). Formato "(61) 9..." ou 9 na 3ª posição sem pontos de CPF = celular.
  if (digitos.length === 11 && /^\(?\d{2}\)?\s?9/.test(c) && !/^\d{3}\.\d{3}\.\d{3}/.test(c)) return '+55' + digitos
  return digitos || c
}

export function gerarPixCopiaECola({ chave, nome, cidade, valor, txid = '***' }) {
  const conta = campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChavePix(chave)))
  const txidLimpo = limpar(txid, 25).replace(/ /g, '') || '***'

  const payload =
    campo('00', '01') +
    conta +
    campo('52', '0000') +
    campo('53', '986') +
    (valor ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(nome, 25) || 'LOJA') +
    campo('60', limpar(cidade, 15) || 'BRASIL') +
    campo('62', campo('05', txidLimpo)) +
    '6304'

  return payload + crc16(payload)
}
