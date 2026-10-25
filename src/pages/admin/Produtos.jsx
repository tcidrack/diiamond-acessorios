import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconeDiamante } from '../../components/Icones.jsx'
import { Titulo, Toggle, Vazio, Erro, useAviso } from '../../components/admin/UI.jsx'
import { api } from '../../lib/api.js'
import { formatBRL } from '../../lib/format.js'
import { emPromocao, percentualDesconto, precoFinal } from '../../lib/precos.js'

export default function Produtos() {
  const navegar = useNavigate()
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    Promise.all([api.listProdutos({ todos: true }), api.listCategorias({ todas: true })])
      .then(([p, c]) => { setProdutos(p); setCategorias(c) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const filtrando = busca.trim() || cat
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return produtos.filter((p) => (!t || p.nome.toLowerCase().includes(t)) && (!cat || String(p.categoria_id) === cat))
  }, [produtos, busca, cat])

  const atualizar = async (produto, campos) => {
    setProdutos((l) => l.map((p) => (p.id === produto.id ? { ...p, ...campos } : p)))
    try {
      await api.salvarProduto({ id: produto.id, ...campos })
    } catch (e) {
      setErro(e.message)
      setProdutos((l) => l.map((p) => (p.id === produto.id ? produto : p)))
    }
  }

  const aoSoltar = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const de = produtos.findIndex((p) => p.id === active.id)
    const para = produtos.findIndex((p) => p.id === over.id)
    const nova = arrayMove(produtos, de, para)
    setProdutos(nova)
    try {
      await api.reordenar('produtos', nova.map((p) => p.id))
      setAviso('Ordem salva')
    } catch (e) {
      setErro(e.message)
    }
  }

  const duplicar = async (p) => {
    const { id, slug, categoria, imagens, created_at, updated_at, ...resto } = p
    const novo = await api.salvarProduto({ ...resto, nome: `${p.nome} (cópia)`, slug: null, ativo: false, ordem: 0 })
    navegar(`/admin/produtos/${novo.id}`)
  }

  return (
    <>
      {aviso}
      <Titulo acao={<Link to="/admin/produtos/novo" className="btn-primario">+ Novo produto</Link>}>Produtos</Titulo>

      <div className="flex flex-wrap gap-2">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" className="campo flex-1" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="campo w-auto" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <p className="mt-2 text-xs text-magenta/45">
        {filtrando ? 'Limpe a busca para reordenar.' : 'Arraste pela alça ⠿ para mudar a ordem na loja (no celular, segure e arraste).'}
      </p>
      <Erro>{erro}</Erro>

      <div className="mt-3">
        {carregando ? (
          <p className="text-sm text-magenta/40">Carregando…</p>
        ) : lista.length === 0 ? (
          <Vazio>{produtos.length ? 'Nenhum produto encontrado.' : 'Nenhum produto ainda. Toque em "+ Novo produto" para começar.'}</Vazio>
        ) : (
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={lista.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {lista.map((p) => (
                  <LinhaProduto key={p.id} produto={p} arrastavel={!filtrando} onAtualizar={atualizar} onDuplicar={duplicar} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </>
  )
}

function LinhaProduto({ produto: p, arrastavel, onAtualizar, onDuplicar }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: !arrastavel })
  const estilo = { transform: CSS.Transform.toString(transform), transition }
  const foto = p.imagens?.[0]?.url

  return (
    <li ref={setNodeRef} style={estilo} className={`card flex items-center gap-3 p-2.5 pr-3 ${isDragging ? 'z-10 shadow-lift' : ''} ${p.ativo ? '' : 'opacity-60'}`}>
      {arrastavel && (
        <button type="button" {...attributes} {...listeners} aria-label={`Mover ${p.nome}`} className="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-magenta/30 active:cursor-grabbing">
          ⠿
        </button>
      )}
      <Link to={`/admin/produtos/${p.id}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
        {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : <IconeDiamante className="m-3.5 h-7 w-7 text-ouro-claro" />}
      </Link>
      <Link to={`/admin/produtos/${p.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold text-magenta">{p.nome}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-magenta/55">
          <span className="tnum font-semibold text-magenta">{formatBRL(precoFinal(p))}</span>
          {emPromocao(p) && <span className="rounded-full bg-magenta px-1.5 text-[10px] font-bold text-white">-{percentualDesconto(p)}%</span>}
          <span>{p.categoria?.nome || 'Sem categoria'}</span>
          <span className={p.estoque === 0 ? 'font-semibold text-vermelho' : ''}>
            {p.estoque === null ? 'estoque livre' : p.estoque === 0 ? 'esgotado' : `${p.estoque} em estoque`}
          </span>
          {p.destaque && <span className="text-ouro">★ destaque</span>}
        </p>
      </Link>
      <div className="hidden sm:block">
        <button type="button" onClick={() => onDuplicar(p)} className="rounded-lg px-2 py-1 text-xs text-magenta/50 hover:bg-blush/50">Duplicar</button>
      </div>
      <Toggle ativo={p.ativo} onChange={(v) => onAtualizar(p, { ativo: v })} />
    </li>
  )
}
