/**
 * Rascunho do cadastro de produto, guardado no próprio aparelho.
 * Texto vai no localStorage; fotos novas (File) vão no IndexedDB, que guarda arquivo sem converter.
 */

const PREFIXO = 'diamond-rascunho-produto-'
const BANCO = 'diamond-rascunhos'
const LOJA = 'fotos'

const chaveDe = (id) => PREFIXO + (id || 'novo')

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function fotosIdb(modo, chave, valor) {
  try {
    const db = await abrir()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOJA, modo === 'ler' ? 'readonly' : 'readwrite')
      const loja = tx.objectStore(LOJA)
      const req = modo === 'ler' ? loja.get(chave) : modo === 'apagar' ? loja.delete(chave) : loja.put(valor, chave)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).finally(() => db.close())
  } catch {
    return undefined // navegador sem IndexedDB (aba anônima antiga): fica só o texto
  }
}

/** `{ form, tipoDesconto, percentual, salvoEm, fotos: [{ chave, file, original }] }` ou null. */
export async function lerRascunho(id) {
  let dados = null
  try { dados = JSON.parse(localStorage.getItem(chaveDe(id))) } catch { /* sem acesso */ }
  if (!dados) return null
  const fotos = (await fotosIdb('ler', chaveDe(id))) || []
  return { ...dados, fotos }
}

export async function gravarRascunho(id, dados, fotos = []) {
  try { localStorage.setItem(chaveDe(id), JSON.stringify({ ...dados, salvoEm: new Date().toISOString() })) } catch { /* cheio */ }
  await fotosIdb('gravar', chaveDe(id), fotos.map(({ chave, file, original }) => ({ chave, file, original })))
}

export async function apagarRascunho(id) {
  try { localStorage.removeItem(chaveDe(id)) } catch { /* sem acesso */ }
  await fotosIdb('apagar', chaveDe(id))
}

export function temRascunho(id) {
  try { return !!localStorage.getItem(chaveDe(id)) } catch { return false }
}
