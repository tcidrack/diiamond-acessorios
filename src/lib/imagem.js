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
