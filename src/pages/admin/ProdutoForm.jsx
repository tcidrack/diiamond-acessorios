import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconeDiamante, IconeLixo, IconeVoltar } from '../../components/Icones.jsx'
import { Campo, Erro, Toggle, useAviso } from '../../components/admin/UI.jsx'
import { api } from '../../lib/api.js'
import { arredondar90, formatBRL, numeroParaCampo, parseBRL, slugify } from '../../lib/format.js'
import EditorFoto from '../../components/admin/EditorFoto.jsx'
import { CORES_PRONTAS, fundoBolinha } from '../../lib/precos.js'

const MATERIAIS = ['Folheado a ouro 18K', 'Prata 925', 'Aço inox', 'Aço inox dourado', 'Banhado a ródio', 'Bijuteria', 'Acetato']

const VAZIO = {
  nome: '', descricao: '', categoria_id: '', material: '', preco: '', preco_promocional: '',
  controlarEstoque: true, estoque: '1', ativo: true, destaque: false,
  grupo_cor: null, cor_nome: '', cor_hex: '',
}

export default function ProdutoForm() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navegar = useNavigate()
  const inputFoto = useRef(null)

  const [form, setForm] = useState(VAZIO)
  const [original, setOriginal] = useState(null)
  const [imagens, setImagens] = useState([]) // já salvas: { id, url, path, ordem }
  const [pendentes, setPendentes] = useState([]) // novas, já enquadradas: { chave, file, original, url }
  const [fila, setFila] = useState([]) // fotos esperando o editor: { fonte, tipo: 'nova'|'pendente'|'salva', alvo }
  const [filaTotal, setFilaTotal] = useState(0)
  const [categorias, setCategorias] = useState([])
  const [todos, setTodos] = useState([]) // para ligar as cores do mesmo modelo
  const [tipoDesconto, setTipoDesconto] = useState('preco') // 'preco' | 'percentual'
  const [percentual, setPercentual] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    api.listCategorias({ todas: true }).then(setCategorias)
    api.listProdutos({ todos: true }).then(setTodos).catch(() => {})
    if (novo) return
    api.getProduto(id).then((p) => {
      if (!p) return setErro('Produto não encontrado.')
      setOriginal(p)
      setImagens(p.imagens || [])
      setForm({
        nome: p.nome, descricao: p.descricao || '', categoria_id: p.categoria_id ? String(p.categoria_id) : '',
        material: p.material || '', preco: numeroParaCampo(p.preco), preco_promocional: numeroParaCampo(p.preco_promocional),
        controlarEstoque: p.estoque !== null, estoque: p.estoque === null ? '' : String(p.estoque),
        ativo: p.ativo, destaque: p.destaque,
        grupo_cor: p.grupo_cor || null, cor_nome: p.cor_nome || '', cor_hex: p.cor_hex || '',
      })
    })
  }, [id, novo])

  // libera a memória das prévias só ao sair da tela
  const pendentesRef = useRef(pendentes)
  pendentesRef.current = pendentes
  useEffect(() => () => pendentesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const set = (chave) => (e) => setForm((f) => ({ ...f, [chave]: e?.target ? e.target.value : e }))
  const preco = parseBRL(form.preco) || 0
  const promo = parseBRL(form.preco_promocional)
  const temPromo = promo !== null && promo > 0 && promo < preco
  const descontoCalc = temPromo ? Math.round((1 - promo / preco) * 100) : 0

  const aplicarPercentual = (valor) => {
    setPercentual(valor)
    const pct = Number(String(valor).replace(',', '.'))
    if (preco > 0 && pct > 0 && pct < 100) {
      setForm((f) => ({ ...f, preco_promocional: numeroParaCampo(Math.round(preco * (1 - pct / 100) * 100) / 100) }))
    } else if (!valor) {
      setForm((f) => ({ ...f, preco_promocional: '' }))
    }
  }

  // cada foto escolhida passa pelo editor para ela enquadrar, uma de cada vez
  const escolherFotos = (e) => {
    const arquivos = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!arquivos.length) return
    setFilaTotal((t) => (fila.length ? t + arquivos.length : arquivos.length))
    setFila((l) => [...l, ...arquivos.map((file) => ({ fonte: file, tipo: 'nova' }))])
  }

  const ajustar = (item) => {
    setFilaTotal(1)
    setFila([item])
  }

  const proximaDaFila = () => setFila((l) => l.slice(1))

  const confirmarFoto = async (file) => {
    const atual = fila[0]
    if (atual.tipo === 'nova') {
      setPendentes((l) => [...l, { chave: crypto.randomUUID(), file, original: atual.fonte, url: URL.createObjectURL(file) }])
    } else if (atual.tipo === 'pendente') {
      setPendentes((l) => l.map((p) => {
        if (p.chave !== atual.alvo.chave) return p
        URL.revokeObjectURL(p.url)
        return { ...p, file, url: URL.createObjectURL(file) }
      }))
    } else {
      // foto já salva: sobe a nova no mesmo lugar e apaga a antiga
      const antiga = atual.alvo
      const nova = await api.uploadImagemProduto(Number(id), file, antiga.ordem)
      const lista = imagens.map((i) => (i.id === antiga.id ? nova : i))
      setImagens(lista)
      await api.excluirImagem(antiga).catch(() => {})
      await api.reordenar('produto_imagens', lista.map((i) => i.id)).catch(() => {})
      setAviso('Foto ajustada!')
    }
    proximaDaFila()
  }

  const removerSalva = async (img) => {
    if (!confirm('Apagar esta foto?')) return
    try {
      await api.excluirImagem(img)
      setImagens((l) => l.filter((i) => i.id !== img.id))
    } catch (e) {
      setErro(e.message)
    }
  }

  const tornarCapa = async (img) => {
    const nova = [img, ...imagens.filter((i) => i.id !== img.id)]
    setImagens(nova)
    try {
      await api.reordenar('produto_imagens', nova.map((i) => i.id))
    } catch (e) {
      setErro(e.message)
    }
  }

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) return setErro('Dê um nome ao produto.')
    if (!(preco > 0)) return setErro('Informe o preço.')
    if (promo !== null && promo > 0 && promo >= preco) return setErro('O preço promocional precisa ser menor que o preço normal.')

    setSalvando(true)
    try {
      const salvo = await api.salvarProduto({
        ...(novo ? {} : { id: Number(id) }),
        nome: form.nome.trim(),
        slug: original?.slug && original.nome === form.nome.trim() ? original.slug : `${slugify(form.nome)}-${Date.now().toString(36).slice(-4)}`,
        descricao: form.descricao.trim(),
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        material: form.material.trim(),
        preco,
        preco_promocional: temPromo ? promo : null,
        estoque: form.controlarEstoque ? Math.max(0, parseInt(form.estoque, 10) || 0) : null,
        ativo: form.ativo,
        destaque: form.destaque,
        // só manda as cores se a SQL 0008 já rodou (o produto tem o campo) ou se ela usou o recurso
        ...('grupo_cor' in (original || {}) || form.grupo_cor || form.cor_nome || form.cor_hex
          ? { grupo_cor: form.grupo_cor || null, cor_nome: form.cor_nome.trim(), cor_hex: form.cor_hex || '' }
          : {}),
        ...(novo ? { ordem: 0 } : {}),
      })

      // fotos novas sobem depois que o produto existe (precisam do id)
      let ordem = imagens.length
      for (const p of pendentes) {
        // já sai do editor quadrada, em WebP e no tamanho certo
        const img = await api.uploadImagemProduto(salvo.id, p.file, ordem++)
        setImagens((l) => [...l, img])
        setPendentes((l) => l.filter((x) => x.chave !== p.chave))
      }

      setAviso('Produto salvo!')
      if (novo) navegar(`/admin/produtos/${salvo.id}`, { replace: true })
      else setOriginal((o) => ({ ...o, ...salvo }))
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!confirm(`Excluir "${form.nome}" de vez? Se quiser só esconder da loja, desligue "Mostrar na loja".`)) return
    try {
      await api.excluirProduto({ ...original, imagens })
      navegar('/admin/produtos', { replace: true })
    } catch (e) {
      setErro(/foreign key|violates/i.test(e.message) ? 'Este produto está em pedidos. Desligue "Mostrar na loja" em vez de excluir.' : e.message)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 pb-24">
      {aviso}
      <Link to="/admin/produtos" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-magenta/60 hover:text-magenta">
        <IconeVoltar className="h-4 w-4" /> Produtos
      </Link>
      <h1 className="font-display text-3xl font-semibold text-magenta">{novo ? 'Novo produto' : form.nome || 'Produto'}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Fotos */}
          <section className="card p-5">
            <h2 className="rotulo">Fotos <span className="font-normal normal-case tracking-normal text-magenta/40">(a primeira é a capa)</span></h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {imagens.map((img, i) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-cream ring-1 ring-blush">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-ouro px-2 py-0.5 text-[10px] font-bold text-white">CAPA</span>}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                    {i > 0 && <button type="button" onClick={() => tornarCapa(img)} className="rounded-lg bg-white/90 px-1.5 py-1 text-[11px] font-medium text-magenta">Capa</button>}
                    <button type="button" onClick={() => ajustar({ fonte: img.url, tipo: 'salva', alvo: img })} className="ml-auto rounded-lg bg-white/90 px-1.5 py-1 text-[11px] font-medium text-magenta">Ajustar</button>
                  </div>
                  <button type="button" onClick={() => removerSalva(img)} aria-label="Apagar foto" className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-vermelho"><IconeLixo className="h-4 w-4" /></button>
                </div>
              ))}
              {pendentes.map((p) => (
                <div key={p.chave} className="relative aspect-square overflow-hidden rounded-2xl ring-2 ring-dashed ring-ouro/60">
                  <img src={p.url} alt="" className="h-full w-full object-cover opacity-80" />
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-magenta">{salvando ? 'enviando…' : 'nova'}</span>
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                    <button type="button" disabled={salvando} onClick={() => ajustar({ fonte: p.original, tipo: 'pendente', alvo: p })} className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium text-magenta">Ajustar</button>
                    <button type="button" disabled={salvando} onClick={() => { URL.revokeObjectURL(p.url); setPendentes((l) => l.filter((x) => x.chave !== p.chave)) }} aria-label="Tirar foto" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-vermelho"><IconeLixo className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => inputFoto.current.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-blush text-magenta/50 transition hover:border-ouro hover:bg-ouro-palido hover:text-magenta">
                <span className="text-2xl">+</span>
                <span className="text-xs font-medium">Adicionar fotos</span>
              </button>
            </div>
            <input ref={inputFoto} type="file" accept="image/*" multiple onChange={escolherFotos} className="hidden" />
            {pendentes.length > 0 && <p className="mt-2 text-xs text-ambar">As fotos novas sobem quando você tocar em Salvar.</p>}
          </section>

          <CoresDoModelo
            form={form}
            setForm={setForm}
            produtoId={novo ? null : Number(id)}
            todos={todos}
            setTodos={setTodos}
            onErro={setErro}
          />

          <section className="card space-y-4 p-5">
            <Campo rotulo="Nome do produto">
              <input value={form.nome} onChange={set('nome')} className="campo font-display text-lg" placeholder="Ex.: Colar Coração Vazado" required />
            </Campo>
            <Campo rotulo="Descrição" ajuda="Tamanho, material, se não escurece, se acompanha caixinha…">
              <textarea value={form.descricao} onChange={set('descricao')} rows={5} className="campo" />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Categoria">
                <select value={form.categoria_id} onChange={set('categoria_id')} className="campo">
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Material">
                <input list="materiais" value={form.material} onChange={set('material')} className="campo" placeholder="Escolha ou digite" />
                <datalist id="materiais">{MATERIAIS.map((m) => <option key={m} value={m} />)}</datalist>
              </Campo>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <Campo rotulo="Preço (R$)">
              <input inputMode="decimal" value={form.preco} onChange={set('preco')} onBlur={() => preco && setForm((f) => ({ ...f, preco: numeroParaCampo(preco) }))} className="campo tnum text-lg font-semibold" placeholder="0,00" required />
            </Campo>
            {preco > 0 && Math.abs(arredondar90(preco) - preco) > 0.001 && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, preco: numeroParaCampo(arredondar90(preco)) }))} className="-mt-2 text-xs text-magenta/50 underline">
                Arredondar para {formatBRL(arredondar90(preco))}
              </button>
            )}

            <div className="borda-ouro rounded-2xl border bg-ouro-palido p-3">
              <p className="rotulo">Desconto / promoção</p>
              <div className="mb-2 flex gap-1 rounded-xl bg-white/70 p-1 text-xs font-medium">
                {[['preco', 'Preço promocional'], ['percentual', '% de desconto']].map(([k, r]) => (
                  <button key={k} type="button" onClick={() => setTipoDesconto(k)} className={`flex-1 rounded-lg py-1.5 ${tipoDesconto === k ? 'bg-magenta text-white' : 'text-magenta/60'}`}>{r}</button>
                ))}
              </div>
              {tipoDesconto === 'preco' ? (
                <input inputMode="decimal" value={form.preco_promocional} onChange={set('preco_promocional')} className="campo tnum" placeholder="Vazio = sem promoção" />
              ) : (
                <input inputMode="decimal" value={percentual} onChange={(e) => aplicarPercentual(e.target.value)} className="campo tnum" placeholder="Ex.: 20" />
              )}
              {temPromo ? (
                <p className="mt-2 text-sm text-magenta">
                  De <s className="text-magenta/50">{formatBRL(preco)}</s> por <strong>{formatBRL(promo)}</strong> <span className="rounded-full bg-magenta px-1.5 py-0.5 text-[11px] font-bold text-white">-{descontoCalc}%</span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-magenta/45">Sem promoção.</p>
              )}
              {temPromo && <button type="button" onClick={() => { setForm((f) => ({ ...f, preco_promocional: '' })); setPercentual('') }} className="mt-1 text-xs text-magenta/60 underline">Tirar promoção</button>}
            </div>

            <div>
              <Toggle ativo={form.controlarEstoque} onChange={(v) => setForm((f) => ({ ...f, controlarEstoque: v }))} rotulo="Controlar estoque" />
              {form.controlarEstoque ? (
                <input type="number" min="0" inputMode="numeric" value={form.estoque} onChange={set('estoque')} className="campo tnum mt-1" aria-label="Quantidade em estoque" />
              ) : (
                <p className="text-xs text-magenta/45">Vende sem limite (sob encomenda, por exemplo).</p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <Toggle ativo={form.ativo} onChange={set('ativo')} rotulo="Mostrar na loja" />
            <Toggle ativo={form.destaque} onChange={set('destaque')} rotulo="Destaque (aparece primeiro)" />
          </section>

          {!novo && (
            <button type="button" onClick={excluir} className="btn-perigo w-full">Excluir produto</button>
          )}
        </div>
      </div>

      <Erro>{erro}</Erro>

      {fila[0] && (
        <EditorFoto
          key={`${filaTotal}-${fila.length}`}
          fonte={fila[0].fonte}
          titulo={fila[0].tipo === 'nova' ? 'Enquadrar foto' : 'Ajustar foto'}
          progresso={filaTotal > 1 ? `Foto ${filaTotal - fila.length + 1} de ${filaTotal}` : null}
          onConfirmar={confirmarFoto}
          onPular={fila.length > 1 ? proximaDaFila : null}
          onCancelar={() => setFila([])}
        />
      )}

      {/* Barra fixa de salvar */}
      <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-blush bg-white/95 px-4 pt-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Link to="/admin/produtos" className="btn-claro">Cancelar</Link>
          <button type="submit" disabled={salvando} className="btn-primario flex-1">{salvando ? 'Salvando…' : 'Salvar produto'}</button>
        </div>
      </div>
    </form>
  )
}

/**
 * Cor deste produto + ligação com as outras cores do mesmo modelo (cada cor é um produto).
 * Ligar e tirar do grupo gravam na hora nos outros produtos; neste, grava na hora se ele já existe.
 */
function CoresDoModelo({ form, setForm, produtoId, todos, setTodos, onErro }) {
  const [buscando, setBuscando] = useState(false)
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const membros = form.grupo_cor ? todos.filter((p) => p.grupo_cor === form.grupo_cor && p.id !== produtoId) : []
  const termo = busca.trim().toLowerCase()
  const candidatos = todos
    .filter((p) => p.id !== produtoId && !(form.grupo_cor && p.grupo_cor === form.grupo_cor))
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
    .slice(0, 8)

  const gravarGrupo = async (ids, grupo) => {
    await Promise.all(ids.map((pid) => api.salvar('produtos', { id: pid, grupo_cor: grupo })))
    setTodos((l) => l.map((p) => (ids.includes(p.id) ? { ...p, grupo_cor: grupo } : p)))
  }

  const executar = async (fn) => {
    setOcupado(true)
    onErro('')
    try {
      await fn()
    } catch (e) {
      onErro(/grupo_cor|cor_nome|cor_hex|column/i.test(e.message) ? 'Rode a SQL 0008_cores_produto.sql no Supabase para usar as cores.' : e.message)
    } finally {
      setOcupado(false)
    }
  }

  const ligar = (alvo) => executar(async () => {
    let grupo = form.grupo_cor
    if (grupo) {
      // traz o escolhido e, se ele já tinha um grupo, todas as cores dele
      const ids = alvo.grupo_cor ? todos.filter((p) => p.grupo_cor === alvo.grupo_cor).map((p) => p.id) : [alvo.id]
      await gravarGrupo(ids, grupo)
    } else if (alvo.grupo_cor) {
      grupo = alvo.grupo_cor
    } else {
      grupo = crypto.randomUUID()
      await gravarGrupo([alvo.id], grupo)
    }
    if (produtoId) await gravarGrupo([produtoId], grupo)
    setForm((f) => ({ ...f, grupo_cor: grupo }))
    setBusca('')
    setBuscando(false)
  })

  const tirar = (membro) => executar(() => gravarGrupo([membro.id], null))

  const sair = () => executar(async () => {
    if (produtoId) await gravarGrupo([produtoId], null)
    setForm((f) => ({ ...f, grupo_cor: null }))
  })

  const escolherPronta = (c) => setForm((f) => ({ ...f, cor_nome: c.nome, cor_hex: c.hex }))
  const mudarNome = (e) => {
    const nome = e.target.value
    const pronta = CORES_PRONTAS.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase())
    setForm((f) => ({ ...f, cor_nome: nome, ...(pronta ? { cor_hex: pronta.hex } : {}) }))
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="rotulo">Cores deste modelo</h2>
        <p className="text-xs text-magenta/55">
          Cada cor é um produto separado. Ligue aqui as outras cores do mesmo modelo e elas aparecem como
          bolinhas no card e na página do produto, para a cliente trocar de cor.
        </p>
      </div>

      <Campo rotulo="Cor deste produto" ajuda="Ex.: Prata, Dourado, Pedra vermelha. Sem cor escolhida, a bolinha mostra a foto do produto.">
        <div className="flex items-center gap-2">
          <Bolinha produto={{ cor_hex: form.cor_hex }} className="h-10 w-10" />
          <input list="cores-prontas" value={form.cor_nome} onChange={mudarNome} className="campo" placeholder="Nome da cor" />
          <datalist id="cores-prontas">{CORES_PRONTAS.map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
        </div>
      </Campo>
      <div className="flex flex-wrap gap-1">
        {CORES_PRONTAS.map((c) => (
          <button
            key={c.nome}
            type="button"
            title={c.nome}
            aria-label={c.nome}
            onClick={() => escolherPronta(c)}
            className="flex h-9 w-9 items-center justify-center rounded-full"
          >
            <span
              className={`block h-6 w-6 rounded-full ring-1 ring-black/10 ${form.cor_hex.toLowerCase() === c.hex ? 'outline-2 outline-offset-2 outline-magenta' : ''}`}
              style={fundoBolinha({ cor_hex: c.hex })}
            />
          </button>
        ))}
        <label className="flex h-9 items-center gap-1.5 rounded-full px-2 text-xs text-magenta/60" title="Outra cor">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(form.cor_hex) ? form.cor_hex : '#cccccc'}
            onChange={(e) => setForm((f) => ({ ...f, cor_hex: e.target.value }))}
            className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          outra
        </label>
        {form.cor_hex && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, cor_hex: '' }))} className="h-9 px-2 text-xs text-magenta/60 underline">
            usar a foto
          </button>
        )}
      </div>

      <div className="border-t border-blush pt-4">
        <p className="rotulo">Outras cores</p>
        {membros.length > 0 ? (
          <ul className="space-y-1.5">
            {membros.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-xl bg-cream/60 px-2 py-1.5">
                <Bolinha produto={m} />
                <span className="min-w-0 flex-1 truncate text-sm text-magenta">
                  {m.nome}{m.cor_nome ? <span className="text-magenta/50"> · {m.cor_nome}</span> : null}
                  {!m.ativo && <span className="text-magenta/40"> (escondido)</span>}
                </span>
                <Link to={`/admin/produtos/${m.id}`} className="text-xs font-medium text-magenta/60 underline">editar</Link>
                <button type="button" disabled={ocupado} onClick={() => tirar(m)} className="text-xs font-medium text-vermelho underline">tirar</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-magenta/45">Nenhuma outra cor ligada.</p>
        )}

        {buscando ? (
          <div className="mt-3 space-y-1.5">
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} className="campo" placeholder="Buscar produto pelo nome" />
            {candidatos.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={ocupado}
                onClick={() => ligar(p)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-ouro-palido"
              >
                {p.imagens?.[0]?.url
                  ? <img src={p.imagens[0].url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  : <span className="h-9 w-9 shrink-0 rounded-lg bg-cream" />}
                <span className="min-w-0 flex-1 truncate text-sm text-magenta">{p.nome}</span>
                <span className="text-xs font-medium text-magenta/60">ligar</span>
              </button>
            ))}
            {candidatos.length === 0 && <p className="text-xs text-magenta/45">Nenhum produto encontrado.</p>}
            <button type="button" onClick={() => { setBuscando(false); setBusca('') }} className="text-xs text-magenta/60 underline">fechar</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setBuscando(true)} className="btn-claro text-sm">+ Ligar outra cor</button>
            {form.grupo_cor && membros.length > 0 && (
              <button type="button" disabled={ocupado} onClick={sair} className="text-xs text-magenta/60 underline">tirar este produto do grupo</button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Bolinha({ produto, className = 'h-7 w-7' }) {
  return <span className={`block shrink-0 rounded-full ring-1 ring-black/10 ${className}`} style={fundoBolinha(produto)} />
}
