import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Erro, Toggle, Vazio, useAviso } from './UI.jsx'
import { IconeLixo } from '../Icones.jsx'

/**
 * Lista editável simples (categorias, bairros, cupons…).
 * `colunas`: [{ chave, rotulo, tipo: 'texto'|'dinheiro'|'numero'|'data'|'select'|'toggle', opcoes, largura }]
 * `preparar(registro)` converte os campos antes de salvar e pode lançar erro de validação.
 */
export default function CrudLista({ tabela, colunas, novoRegistro, preparar = (r) => r, ordem = 'ordem', vazio, rotuloNovo = 'Adicionar', mostrar = (r) => r }) {
  const [linhas, setLinhas] = useState([])
  const [editando, setEditando] = useState({}) // id -> rascunho
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  const carregar = () => api.listar(tabela, { ordem }).then((l) => setLinhas(l.map(mostrar))).catch((e) => setErro(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [tabela])

  const rascunho = (r) => editando[r.id ?? 'novo'] ?? r
  const alterar = (r, chave, valor) => setEditando((e) => ({ ...e, [r.id ?? 'novo']: { ...rascunho(r), [chave]: valor } }))
  const sujo = (r) => (r.id ?? 'novo') in editando

  const salvar = async (r) => {
    setErro('')
    try {
      const dados = preparar({ ...rascunho(r) })
      const salvo = await api.salvar(tabela, dados)
      setEditando(({ [r.id ?? 'novo']: _, ...resto }) => resto)
      setLinhas((l) => (r.id ? l.map((x) => (x.id === r.id ? mostrar(salvo) : x)) : [...l, mostrar(salvo)]))
      setAviso('Salvo!')
    } catch (e) {
      setErro(/duplicate|unique/i.test(e.message) ? 'Já existe um registro com esse nome/código.' : e.message)
    }
  }

  const excluir = async (r) => {
    if (!confirm('Excluir?')) return
    try {
      await api.excluir(tabela, r.id)
      setLinhas((l) => l.filter((x) => x.id !== r.id))
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

  const linha = (r, ehNovo = false) => (
    <li key={r.id ?? 'novo'} className={`card flex flex-wrap items-end gap-3 p-3 ${ehNovo ? 'ring-2 ring-ouro/50' : ''}`}>
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
    </li>
  )

  return (
    <div className="space-y-3">
      {aviso}
      <Erro>{erro}</Erro>
      {linhas.length === 0 && !novo && <Vazio>{vazio}</Vazio>}
      <ul className="space-y-2">
        {linhas.map((r) => linha(r))}
        {novo && linha(novo, true)}
      </ul>
      {!novo && (
        <button type="button" onClick={() => setEditando((e) => ({ ...e, novo: { ...novoRegistro(linhas) } }))} className="btn-claro">
          + {rotuloNovo}
        </button>
      )}
    </div>
  )
}
