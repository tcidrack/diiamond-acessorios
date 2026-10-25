/**
 * Instagram Messaging (Graph API).
 * Padrão: "Instagram API com login do Instagram" -> https://graph.instagram.com
 * Se o app usar login pelo Facebook (Página), defina IG_API_BASE=https://graph.facebook.com/v23.0
 * e IG_ACCOUNT_ID=<id da Página>.
 */
const BASE = Deno.env.get('IG_API_BASE') || 'https://graph.instagram.com/v23.0'
const CONTA = Deno.env.get('IG_ACCOUNT_ID') || 'me'
const TOKEN = () => Deno.env.get('IG_ACCESS_TOKEN') || ''

async function chamar(caminho: string, init: RequestInit = {}) {
  const url = `${BASE}/${caminho}${caminho.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(TOKEN())}`
  const resp = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const corpo = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`Instagram ${resp.status}: ${corpo?.error?.message || 'erro desconhecido'}`)
  return corpo
}

/** Envia texto ao cliente. Só funciona até 24h depois da última mensagem dele (regra da Meta). */
export async function enviarTexto(destinatario: string, texto: string): Promise<string | null> {
  // o Instagram corta mensagens acima de 1000 caracteres
  const corpo = await chamar(`${CONTA}/messages`, {
    method: 'POST',
    body: JSON.stringify({ recipient: { id: destinatario }, message: { text: texto.slice(0, 1000) } }),
  })
  return corpo.message_id ?? null
}

export async function perfil(igsid: string): Promise<{ name?: string; username?: string }> {
  try {
    return await chamar(`${igsid}?fields=name,username`)
  } catch {
    return {}
  }
}

export interface MensagemIG {
  id: string
  message?: string
  created_time: string
  from: { id: string; username?: string }
}

export async function listarConversas(limite = 25): Promise<{ id: string; messages?: { data: MensagemIG[] } }[]> {
  const corpo = await chamar(`${CONTA}/conversations?platform=instagram&limit=${limite}&fields=messages.limit(40){id,message,created_time,from}`)
  return corpo.data || []
}

/** Confere a assinatura X-Hub-Signature-256 que a Meta manda no webhook. */
export async function assinaturaValida(corpoBruto: string, cabecalho: string | null): Promise<boolean> {
  const segredo = Deno.env.get('IG_APP_SECRET')
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpoBruto))
  const esperado = Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, '0')).join('')
  const recebido = cabecalho.slice(7)
  if (recebido.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i)
  return diferenca === 0
}
