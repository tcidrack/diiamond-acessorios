import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Preco from '../../components/Preco.jsx'
import Quantidade from '../../components/Quantidade.jsx'
import ProductCard from '../../components/ProductCard.jsx'
import { IconeDiamante, IconeVoltar, IconeWhatsApp } from '../../components/Icones.jsx'
import { api } from '../../lib/api.js'
import { linkWhatsApp } from '../../lib/format.js'
import { esgotado, percentualDesconto } from '../../lib/precos.js'
import { useCarrinho } from '../../hooks/useCarrinho.jsx'
import { useLoja } from '../../hooks/useLoja.jsx'

export default function Produto() {
  const { slug } = useParams()
  const { produtos, config } = useLoja()
  const { adicionar } = useCarrinho()
  const navegar = useNavigate()
  const [produto, setProduto] = useState(() => produtos.find((p) => p.slug === slug || String(p.id) === slug) || null)
  const [carregando, setCarregando] = useState(!produto)
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [qtd, setQtd] = useState(1)

  useEffect(() => {
    let ativo = true
    setFotoAtiva(0)
    setQtd(1)
    api.getProduto(slug).then((p) => {
      if (!ativo) return
      setProduto(p && p.ativo ? p : null)
      setCarregando(false)
    }).catch(() => ativo && setCarregando(false))
    window.scrollTo({ top: 0 })
    return () => { ativo = false }
  }, [slug])

  useEffect(() => {
    if (produto) document.title = `${produto.nome} · ${config?.nome || 'Diiamond Acessórios'}`
    return () => { document.title = config?.nome || 'Diiamond Acessórios' }
  }, [produto, config])

  if (carregando) {
    return <div className="mx-auto mt-8 h-96 max-w-6xl animate-pulse rounded-3xl bg-white/60 px-4" />
  }

  if (!produto) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <IconeDiamante className="h-12 w-12 text-ouro-claro" />
        <p className="font-display text-xl text-magenta">Produto não encontrado</p>
        <Link to="/" className="btn-claro">Voltar para a loja</Link>
      </div>
    )
  }

  const fotos = produto.imagens || []
  const semEstoque = esgotado(produto)
  const off = percentualDesconto(produto)
  const max = produto.estoque ?? 50
  const parecidos = produtos.filter((p) => p.categoria_id === produto.categoria_id && p.id !== produto.id && !esgotado(p)).slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Link to="/" className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-magenta/60 hover:text-magenta">
        <IconeVoltar className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-10">
        {/* Galeria */}
        <div>
          <div className="card relative aspect-square overflow-hidden">
            {fotos.length ? (
              <img src={fotos[fotoAtiva]?.url} alt={produto.nome} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center"><IconeDiamante className="h-20 w-20 text-ouro-claro" /></span>
            )}
            {off > 0 && !semEstoque && (
              <span className="absolute top-3 left-3 rounded-full bg-magenta px-3 py-1 text-sm font-bold text-white shadow-soft">-{off}%</span>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="sem-barra mt-3 flex gap-2 overflow-x-auto">
              {fotos.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFotoAtiva(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={`h-18 w-18 shrink-0 overflow-hidden rounded-2xl ring-2 transition ${i === fotoAtiva ? 'ring-ouro' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex flex-col gap-4">
          <div>
            {produto.categoria && (
              <Link to={`/?cat=${produto.categoria.slug}`} className="text-xs font-semibold tracking-widest text-ouro uppercase hover:underline">
                {produto.categoria.nome}
              </Link>
            )}
            <h1 className="mt-1 font-display text-3xl leading-tight font-semibold text-magenta sm:text-4xl">{produto.nome}</h1>
            {produto.material && <p className="mt-1 text-sm text-magenta/60">{produto.material}</p>}
          </div>

          <span aria-hidden="true" className="fio-ouro block h-px" />

          <Preco produto={produto} grande />

          {semEstoque ? (
            <p className="rounded-2xl bg-blush/60 px-4 py-3 text-sm font-medium text-magenta">Esgotado no momento.</p>
          ) : (
            <>
              {produto.estoque !== null && produto.estoque <= 3 && (
                <p className="text-sm font-medium text-ambar">Só {produto.estoque === 1 ? 'resta 1 unidade' : `restam ${produto.estoque} unidades`}!</p>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-magenta/60">Quantidade</span>
                <Quantidade valor={qtd} max={max} onChange={(q) => setQtd(Math.max(1, Math.min(q, max)))} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => navegar(`/checkout?comprar=${produto.id}&qtd=${qtd}`)} className="btn-primario flex-1 text-base">
                  Comprar agora
                </button>
                <button type="button" onClick={() => adicionar(produto, qtd)} className="btn-claro flex-1 text-base">
                  Adicionar ao carrinho
                </button>
              </div>
            </>
          )}

          {config?.whatsapp && (
            <a
              href={linkWhatsApp(config.whatsapp, `Olá! Tenho uma dúvida sobre: ${produto.nome}\n${window.location.href}`)}
              target="_blank"
              rel="noreferrer"
              className="btn-claro"
            >
              <IconeWhatsApp /> Tirar dúvida no WhatsApp
            </a>
          )}

          {produto.descricao && (
            <div className="card p-5">
              <h2 className="rotulo">Descrição</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{produto.descricao}</p>
            </div>
          )}
        </div>
      </div>

      {parecidos.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-magenta">Você também vai amar</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {parecidos.map((p) => <ProductCard key={p.id} produto={p} />)}
          </div>
        </section>
      )}
    </div>
  )
}
