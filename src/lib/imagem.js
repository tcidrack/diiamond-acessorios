/**
 * Abre uma foto (blob: ou URL) para o editor. Foto já salva no Storage vem com CORS e um
 * parâmetro novo na URL, para o navegador não reaproveitar a cópia sem CORS e travar o canvas.
 */
export function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    const remota = /^https?:/i.test(url)
    if (remota) el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = remota ? `${url}${url.includes('?') ? '&' : '?'}editar=${Date.now()}` : url
  })
}

/**
 * Gera a foto quadrada do jeito que foi enquadrada no editor.
 * `r`, `x`, `y` estão em frações da moldura (moldura = 1). O que sobra fica branco.
 */
export async function recortarImagem(el, { r, x, y }, { lado = 1200, qualidade = 0.85 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, lado, lado)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(el, x * lado, y * lado, el.naturalWidth * r * lado, el.naturalHeight * r * lado)

  let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', qualidade))
  // navegador sem WebP (Safari antigo) devolve PNG: usa JPEG, que é bem mais leve
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Não foi possível preparar a foto.')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `foto-${Date.now()}.${ext}`, { type: blob.type })
}

/**
 * Reduz a foto no próprio navegador antes de subir (foto de celular tem 4–8 MB).
 * Sai em WebP com no máximo 1400px no lado maior — fica nítida e leve na loja.
 */
export async function comprimirImagem(file, { max = 1400, qualidade = 0.85 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', qualidade))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
}
