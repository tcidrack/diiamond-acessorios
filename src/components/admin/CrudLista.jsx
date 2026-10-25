import { useEffect, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../lib/api.js'
import { Erro, Toggle, Vazio, useAviso } from './UI.jsx'
import { IconeArrastar, IconeLixo } from '../Icones.jsx'

/**
 * Lista editável simples (categorias, bairros, cupons…).
 * `colunas`: [{ chave, rotulo, tipo: 'texto'|'dinheiro'|'numero'|'data'|'select'|'toggle', opcoes, largura }]
 * `preparar(registro)` converte os campos antes de salvar e pode lançar erro de validação.
 * `arrastavel`: ordena arrastando e mantém o campo `ordem` sempre 1..n (digitar uma posição empurra as outras).
 */
export default function CrudLista({ tabela, colunas, novoRegistro, preparar = (r) => r, ordem = 'ordem', vazio, rotuloNovo = 'Adicionar', mostrar = (r) => r, arrastavel = false }) {
  const [linhas, setLinhas] = useState([])
  const [editando, setEditando] = useState({}) // id -> rascunho
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const carregar = () => api.listar(tabela, { ordem }).then((l) => setLinhas(l.map(mostrar))).catch((e) => setErro(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [tabela])

  const rascunho = (r) => editando[r.id ?? 'novo'] ?? r
  const alterar = (r, chave, valor) => setEditando((e) => ({ ...e, [r.id ?? 'novo']: { ...rascunho(r), [chave]: valor } }))
  const sujo = (r) => (r.id ?? 'novo') in editando

  /** Grava a nova sequência (ordem 1..n) na tela, nos rascunhos abertos e no banco. */
  const aplicarOrdem = async (lista) => {
    const antes = new Map(linhas.map((r) => [r.id, r.ordem]))
    const nova = lista.map((r, i) => ({ ...r, ordem: i + 1 }))
    setLinhas(nova)
    setEditando((e) => Object.fromEntries(Object.entries(e).map(([id, d]) => {
      const n = nova.find((r) => String(r.id) === id)
      return [id, n ? { ...d, ordem: n.ordem } : d]
    })))
    if (nova.every((r) => antes.get(r.id) === r.ordem)) return
    await api.reordenar(tabela, nova.map((r) => r.id))
  }

  const salvar = async (r) => {
    setErro('')
    try {
      const dados = preparar({ ...rascunho(r) })
      const salvo = mostrar(await api.salvar(tabela, dados))
      setEditando(({ [r.id ?? 'novo']: _, ...resto }) => resto)
      if (arrastavel) {
        // a linha vai para a posição digitada e as outras se ajustam
        const resto = linhas.filter((x) => x.id !== salvo.id)
        const pos = Math.min(Math.max(Math.round(Number(salvo.ordem)) || resto.length + 1, 1), resto.length + 1) - 1
        await aplicarOrdem([...resto.slice(0, pos), salvo, ...resto.slice(pos)])
      } else {
        setLinhas((l) => (r.id ? l.map((x) => (x.id === r.id ? salvo : x)) : [...l, salvo]))
      }
      setAviso('Salvo!')
    } catch (e) {
      setErro(/duplicate|unique/i.test(e.message) ? 'Já existe um registro com esse nome/código.' : e.message)
      if (arrastavel) carregar()
    }
  }

  const aoSoltar = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const de = linhas.findIndex((r) => r.id === active.id)
    const para = linhas.findIndex((r) => r.id === over.id)
    setErro('')
    try {
      await aplicarOrdem(arrayMove(linhas, de, para))
      setAviso('Ordem salva')
    } catch (e) {
      setErro(e.message)
      carregar()
    }
  }

  const excluir = async (r) => {
    if (!confirm('Excluir?')) return
    try {
      await api.excluir(tabela, r.id)
      const resto = linhas.filter((x) => x.id !== r.id)
      if (arrastavel) await aplicarOrdem(resto)
      else setLinhas(resto)
    } catch (e) {
      setErro(e.message)
    }
  }

  const novo = editando.novo

  const celula = (r, c) => {
    const valor = rascunho(r)[c.chave] ?? ''
    const comum = { 'aria-label': c.rotulo, className: 'campo py-1.5' }
    if (c.tipo === 'toggle') return <Toggle ativo={!!valor} onChange={(v) => alterar(r, c.chave, v)} rotulo={c.rotulo} />
    if (c.tipo === 'select') {
      return (
        <select value={valor} onChange={(e) => alterar(r, c.chave, e.target.value)} {...comum}>
          {c.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      )
    }
    return (
      <input
        type={c.tipo === 'data' ? 'date' : 'text'}
        inputMode={c.tipo === 'dinheiro' || c.tipo === 'numero' ? 'decimal' : undefined}
        value={valor}
        placeholder={c.placeholder}
        onChange={(e) => alterar(r, c.chave, e.target.value)}
        {...comum}
      />
    )
  }

  const conteudo = (r, ehNovo) => (
    <>
      {colunas.map((c) => (
        <label key={c.chave} className={c.largura || 'min-w-[120px] flex-1'}>
          {c.tipo !== 'toggle' && <span className="rotulo">{c.rotulo}</span>}
          {celula(r, c)}
        </label>
      ))}
      <div className="flex gap-1.5">
        {(sujo(r) || ehNovo) && <button type="button" onClick={() => salvar(r)} className="btn-primario">Salvar</button>}
        {ehNovo ? (
          <button type="button" onClick={() => setEditando(({ novo: _, ...resto }) => resto)} className="btn-claro">Cancelar</button>
        ) : (
          <button type="button" onClick={() => excluir(r)} aria-label="Excluir" className="flex h-11 w-11 items-center justify-center rounded-xl text-magenta/30 hover:bg-vermelho-bg/60 hover:text-vermelho"><IconeLixo /></button>
        )}
      </div>
    </>
  )

  const linha = (r, ehNovo = false) => (
    <li key={r.id ?? 'novo'} className={`card flex flex-wrap items-end gap-3 p-3 ${ehNovo ? 'ring-2 ring-ouro/50' : ''}`}>
      {conteudo(r, ehNovo)}
    </li>
  )

  return (
    <div className="space-y-3">
      {aviso}
      <Erro>{erro}</Erro>
      {linhas.length === 0 && !novo && <Vazio>{vazio}</Vazio>}
      {arrastavel ? (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={linhas.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {linhas.map((r) => (
                <LinhaArrastavel key={r.id} id={r.id} nome={r.nome}>{conteudo(r, false)}</LinhaArrastavel>
              ))}
              {novo && linha(novo, true)}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="space-y-2">
          {linhas.map((r) => linha(r))}
          {novo && linha(novo, true)}
        </ul>
      )}
      {!novo && (
        <button type="button" onClick={() => setEditando((e) => ({ ...e, novo: { ...novoRegistro(linhas) } }))} className="btn-claro">
          + {rotuloNovo}
        </button>
      )}
    </div>
  )
}

function LinhaArrastavel({ id, nome, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const estilo = { transform: CSS.Transform.toString(transform), transition }
  return (
    <li ref={setNodeRef} style={estilo} className={`card flex flex-wrap items-end gap-3 p-3 pl-1.5 ${isDragging ? 'relative z-10 shadow-lift' : ''}`}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${nome || 'item'}`}
        className="flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center self-end text-magenta/30 hover:text-magenta/60 active:cursor-grabbing"
      >
        <IconeArrastar />
      </button>
      {children}
    </li>
  )
}
