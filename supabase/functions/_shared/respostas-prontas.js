/**
 * Respostas prontas: mandadas por palavra-chave, sem chamar a IA.
 * ESTE ARQUIVO TEM UMA CÓPIA IDÊNTICA em supabase/functions/_shared/respostas-prontas.js
 * (as funções do servidor não enxergam a pasta src). Mudou aqui, copie lá.
 *
 * Palavras-chave:
 *  - "entrega"        -> a palavra aparece na mensagem
 *  - "qual pix"       -> todas as palavras aparecem (em qualquer ordem)
 *  - "entreg*"        -> palavra começando com "entreg" (entrega, entregam, entregar…)
 *  - mensagem_exata   -> a mensagem inteira precisa ser só aquilo ("oi", "bom dia")
 */

export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9*\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palavraBate(parte, palavras) {
  if (parte.endsWith('*')) {
    const raiz = parte.slice(0, -1)
    return raiz.length > 0 && palavras.some((p) => p.startsWith(raiz))
  }
  return palavras.includes(parte)
}

/** Devolve a resposta automática que melhor combina com o texto, ou null. */
export function encontrarRespostaPronta(texto, respostas) {
  const mensagem = normalizar(texto).replace(/\*/g, '')
  if (!mensagem) return null
  const palavras = mensagem.split(' ')

  let melhor = null
  let peso = 0
  for (const r of respostas || []) {
    if (!r.ativo || !r.automatica) continue
    for (const termo of r.palavras_chave || []) {
      const t = normalizar(termo)
      if (!t) continue
      const partes = t.split(' ')
      const bate = r.mensagem_exata
        ? mensagem === t.replace(/\*/g, '') || (t.includes('*') && partes.length === palavras.length && partes.every((p, i) => palavraBate(p, [palavras[i]])))
        : partes.every((p) => palavraBate(p, palavras))
      // termo com mais palavras é mais específico: ganha de termos curtos
      const pesoTermo = partes.length + (r.mensagem_exata ? 0.5 : 0)
      if (bate && pesoTermo > peso) {
        melhor = r
        peso = pesoTermo
      }
    }
  }
  return melhor
}
