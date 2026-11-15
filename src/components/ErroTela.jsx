import { Component, lazy } from 'react'

const CHAVE_RECARGA = 'diamond-recarregou-em'

/** Pedaço do site que não baixou: normalmente o site foi atualizado e o pedaço antigo não existe mais. */
const erroDeCarga = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError|text\/html/i.test(String(e?.message || e))

/** Recarrega a página uma vez (no máximo a cada 30 s, para nunca ficar em loop). Devolve se recarregou. */
function recarregarUmaVez() {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA)) || 0
    if (Date.now() - ultima < 30000) return false
    sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()))
  } catch { /* modo privado: recarrega mesmo assim */ }
  window.location.reload()
  return true
}

/**
 * `lazy()` que aguenta atualização do site: se o pedaço da página não baixar (versão antiga aberta há muito
 * tempo), recarrega uma vez e já abre a versão nova, em vez de deixar a tela branca.
 */
export function lazyComRecarga(importar) {
  return lazy(() =>
    importar().catch((e) => {
      if (erroDeCarga(e) && recarregarUmaVez()) return new Promise(() => {}) // espera a recarga
      throw e
    }),
  )
}

/** Qualquer erro na tela vira um aviso com "Recarregar", nunca uma tela branca. */
export default class ErroTela extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro) {
    console.error(erro)
    if (erroDeCarga(erro)) recarregarUmaVez()
  }

  render() {
    if (!this.state.erro) return this.props.children
    const atualizou = erroDeCarga(this.state.erro)
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="card max-w-sm p-6 text-center">
          <p className="font-display text-xl font-semibold text-magenta">{atualizou ? 'O site foi atualizado' : 'Algo deu errado'}</p>
          <p className="mt-2 text-sm text-magenta/60">
            {atualizou ? 'Recarregue a página para abrir a versão nova.' : 'Recarregue a página. Se continuar, tente de novo em alguns minutos.'}
          </p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primario mt-4 w-full">Recarregar</button>
        </div>
      </div>
    )
  }
}
