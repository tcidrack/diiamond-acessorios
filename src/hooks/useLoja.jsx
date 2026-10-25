import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const LojaContext = createContext(null)

/** Configuração, categorias e produtos da vitrine — carregados uma vez e compartilhados. */
export function LojaProvider({ children }) {
  const [config, setConfig] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    try {
      const [cfg, cats, prods] = await Promise.all([api.getConfig(), api.listCategorias(), api.listProdutos()])
      setConfig(cfg)
      setCategorias(cats)
      setProdutos(prods)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
    // estoque e preço mudam: atualiza ao voltar para a aba
    const aoVoltar = () => document.visibilityState === 'visible' && recarregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [recarregar])

  return (
    <LojaContext.Provider value={{ config, categorias, produtos, carregando, erro, recarregar }}>
      {children}
    </LojaContext.Provider>
  )
}

export function useLoja() {
  return useContext(LojaContext)
}
