import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { precoFinal } from '../lib/precos.js'

const CHAVE = 'diamond-carrinho-v1'
const CarrinhoContext = createContext(null)

function lerSalvo() {
  try {
    const itens = JSON.parse(localStorage.getItem(CHAVE))
    return Array.isArray(itens) ? itens : []
  } catch {
    return []
  }
}

/** Item de carrinho/pedido a partir do produto (quantidade limitada ao estoque). */
export function itemDoProduto(produto, quantidade = 1) {
  return {
    produto_id: produto.id,
    nome: produto.nome,
    slug: produto.slug,
    imagem: produto.imagens?.[0]?.url || null,
    preco: precoFinal(produto),
    preco_cheio: Number(produto.preco),
    estoque: produto.estoque,
    quantidade: Math.max(1, Math.min(quantidade, produto.estoque ?? 50)),
  }
}

/**
 * Carrinho guardado no navegador. Cada item leva uma "foto" do produto para
 * mostrar na hora; o preço que vale é recalculado no servidor ao finalizar.
 */
export function CarrinhoProvider({ children }) {
  const [itens, setItens] = useState(lerSalvo)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)) } catch { /* modo privado */ }
  }, [itens])

  const adicionar = useCallback((produto, quantidade = 1) => {
    setItens((atual) => {
      const limite = produto.estoque ?? 50
      const existente = atual.find((i) => i.produto_id === produto.id)
      const { quantidade: _, ...resumo } = itemDoProduto(produto)
      if (existente) {
        return atual.map((i) =>
          i.produto_id === produto.id ? { ...i, ...resumo, quantidade: Math.min(i.quantidade + quantidade, limite) } : i,
        )
      }
      return [...atual, { ...resumo, quantidade: Math.min(quantidade, limite) }]
    })
    setAberto(true)
  }, [])

  const alterarQuantidade = useCallback((produtoId, quantidade) => {
    setItens((atual) =>
      atual
        .map((i) => (i.produto_id === produtoId ? { ...i, quantidade: Math.min(quantidade, i.estoque ?? 50) } : i))
        .filter((i) => i.quantidade > 0),
    )
  }, [])

  const remover = useCallback((produtoId) => setItens((atual) => atual.filter((i) => i.produto_id !== produtoId)), [])
  const limpar = useCallback(() => setItens([]), [])

  /** Atualiza preço/estoque com os dados mais novos do catálogo. */
  const sincronizar = useCallback((produtos) => {
    setItens((atual) => {
      let mudou = false
      const novos = atual.flatMap((i) => {
        const p = produtos.find((x) => x.id === i.produto_id)
        if (!p) { mudou = true; return [] }
        const preco = precoFinal(p)
        if (preco !== i.preco || p.estoque !== i.estoque) {
          mudou = true
          return [{ ...i, preco, preco_cheio: Number(p.preco), estoque: p.estoque, quantidade: Math.min(i.quantidade, p.estoque ?? 50) }].filter((x) => x.quantidade > 0)
        }
        return [i]
      })
      return mudou ? novos : atual
    })
  }, [])

  const valor = useMemo(() => {
    const quantidadeTotal = itens.reduce((s, i) => s + i.quantidade, 0)
    const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
    return { itens, quantidadeTotal, subtotal, adicionar, alterarQuantidade, remover, limpar, sincronizar, aberto, setAberto }
  }, [itens, adicionar, alterarQuantidade, remover, limpar, sincronizar, aberto])

  return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>
}

export function useCarrinho() {
  return useContext(CarrinhoContext)
}
