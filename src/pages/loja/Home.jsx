import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../../components/ProductCard.jsx'
import Seletor from '../../components/Seletor.jsx'
import { IconeBusca, IconeDiamante, IconeFechar } from '../../components/Icones.jsx'
import { useLoja } from '../../hooks/useLoja.jsx'
import { emPromocao, esgotado, precoFinal } from '../../lib/precos.js'

const ORDENS = {
  relevancia: 'Destaques',
  menor: 'Menor preço',
  maior: 'Maior preço',
  novos: 'Novidades',
}

function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function Home() {
  const { produtos, categorias, carregando, erro, recarregar } = useLoja()
  // filtros na URL: dá para compartilhar "loja.com/?cat=brincos" no Instagram
  const [params, setParams] = useSearchParams()
  const busca = params.get('q') || ''
  const cat = params.get('cat') || ''
  const material = params.get('material') || ''
  const promo = params.get('promo') === '1'
  const ordem = params.get('ordem') || 'relevancia'

  const mudar = (chave, valor) => mudarVarios({ [chave]: valor })
  const mudarVarios = (campos) => {
    const novo = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(campos)) {
      if (valor) novo.set(chave, valor)
      else novo.delete(chave)
    }
    setParams(novo, { replace: true })
  }

  const materiais = useMemo(
    () => [...new Set(produtos.map((p) => p.material).filter(Boolean))].sort(),
    [produtos],
  )
  const categoriasComProduto = useMemo(
    () => categorias.filter((c) => produtos.some((p) => p.categoria_id === c.id)),
    [categorias, produtos],
  )
  const temPromo = produtos.some(emPromocao)

  const filtrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    let lista = produtos.filter((p) => {
      if (cat && p.categoria?.slug !== cat) return false
      if (material && p.material !== material) return false
      if (promo && !emPromocao(p)) return false
      if (termos.length) {
        const texto = normalizar(`${p.nome} ${p.descricao} ${p.material} ${p.categoria?.nome}`)
        if (!termos.every((t) => texto.includes(t))) return false
      }
      return true
    })
    const porDisponivel = (a, b) => Number(esgotado(a)) - Number(esgotado(b))
    if (ordem === 'menor') lista = lista.sort((a, b) => porDisponivel(a, b) || precoFinal(a) - precoFinal(b))
    else if (ordem === 'maior') lista = lista.sort((a, b) => porDisponivel(a, b) || precoFinal(b) - precoFinal(a))
    else if (ordem === 'novos') lista = lista.sort((a, b) => porDisponivel(a, b) || (a.created_at < b.created_at ? 1 : -1))
    else lista = lista.sort((a, b) => porDisponivel(a, b) || Number(b.destaque) - Number(a.destaque) || a.ordem - b.ordem)
    return lista
  }, [produtos, busca, cat, material, promo, ordem])

  const filtrando = busca || cat || material || promo

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Busca */}
      <div className="relative mt-5">
        <IconeBusca className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-magenta/40" />
        <input
          type="search"
          value={busca}
          onChange={(e) => mudar('q', e.target.value)}
          placeholder="Buscar anel, colar, prata…"
          aria-label="Buscar produtos"
          className="campo h-12 rounded-2xl pl-11 shadow-soft"
        />
      </div>

      {/* Categorias */}
      <nav className="sticky top-0 z-30 -mx-4 mt-3 border-b border-blush/70 bg-cream/85 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6" aria-label="Categorias">
        <div className="sem-barra flex gap-2 overflow-x-auto">
          <Pilula ativa={!cat && !promo} onClick={() => mudarVarios({ cat: '', promo: '' })}>Tudo</Pilula>
          {temPromo && (
            <Pilula ativa={promo} onClick={() => mudar('promo', promo ? '' : '1')} destaque>
              % Promoções
            </Pilula>
          )}
          {categoriasComProduto.map((c) => (
            <Pilula key={c.id} ativa={cat === c.slug} onClick={() => mudar('cat', cat === c.slug ? '' : c.slug)}>
              {c.nome}
            </Pilula>
          ))}
        </div>
      </nav>

      {/* Filtros finos */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {materiais.length > 1 && (
          <Seletor
            aria-label="Material"
            valor={material}
            opcoes={[{ valor: '', rotulo: 'Todos os materiais' }, ...materiais.map((m) => ({ valor: m, rotulo: m }))]}
            onChange={(v) => mudar('material', v)}
          />
        )}
        <Seletor
          aria-label="Ordenar"
          valor={ordem}
          opcoes={Object.entries(ORDENS).map(([valor, rotulo]) => ({ valor, rotulo }))}
          onChange={(v) => mudar('ordem', v === 'relevancia' ? '' : v)}
        />
        {filtrando && (
          <button type="button" onClick={() => setParams({}, { replace: true })} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-sm font-medium text-magenta/60 hover:bg-blush/50">
            <IconeFechar className="h-4 w-4" /> Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-magenta/45">
          {filtrados.length} {filtrados.length === 1 ? 'peça' : 'peças'}
        </span>
      </div>

      {erro && (
        <div className="card mt-6 p-6 text-center">
          <p className="text-vermelho">Não consegui carregar os produtos.</p>
          <p className="mt-1 text-sm text-magenta/50">{erro}</p>
          <button type="button" onClick={recarregar} className="btn-claro mt-4">Tentar de novo</button>
        </div>
      )}

      {carregando ? (
        <Grade>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-white/60" />
          ))}
        </Grade>
      ) : filtrados.length === 0 && !erro ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconeDiamante className="h-12 w-12 text-ouro-claro" />
          {produtos.length === 0 ? (
            <>
              <p className="font-display text-lg text-magenta">Novidades chegando em breve ✨</p>
              <p className="text-sm text-magenta/50">Estamos preparando as peças. Volte logo!</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg text-magenta">Nenhuma peça encontrada</p>
              <p className="text-sm text-magenta/50">Tente outra palavra ou limpe os filtros.</p>
            </>
          )}
        </div>
      ) : (
        <Grade>
          {filtrados.map((p) => <ProductCard key={p.id} produto={p} />)}
        </Grade>
      )}
    </div>
  )
}

function Grade({ children }) {
  return <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>
}

function Pilula({ ativa, destaque, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition ${
        ativa
          ? 'bg-magenta text-white shadow-soft'
          : destaque
            ? 'bg-ouro-palido text-[#7a5f00] ring-1 ring-ouro/40 hover:bg-ouro-claro/50'
            : 'bg-white/80 text-magenta/70 ring-1 ring-blush hover:bg-blush/50 hover:text-magenta'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}
