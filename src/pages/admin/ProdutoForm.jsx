import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconeDiamante, IconeLixo, IconeVoltar } from '../../components/Icones.jsx'
import { Campo, Erro, Toggle, useAviso } from '../../components/admin/UI.jsx'
import { api } from '../../lib/api.js'
import { arredondar90, formatBRL, numeroParaCampo, parseBRL, slugify } from '../../lib/format.js'
import { comprimirImagem } from '../../lib/imagem.js'

const MATERIAIS = ['Folheado a ouro 18K', 'Prata 925', 'Aço inox', 'Aço inox dourado', 'Banhado a ródio', 'Bijuteria', 'Acetato']

const VAZIO = {
  nome: '', descricao: '', categoria_id: '', material: '', preco: '', preco_promocional: '',
  controlarEstoque: true, estoque: '1', ativo: true, destaque: false,
}

export default function ProdutoForm() {
  const { id } = useParams()
  const novo = id === 'novo'
  const navegar = useNavigate()
  const inputFoto = useRef(null)

  const [form, setForm] = useState(VAZIO)
  const [original, setOriginal] = useState(null)
  const [imagens, setImagens] = useState([]) // já salvas: { id, url, path, ordem }
  const [pendentes, setPendentes] = useState([]) // novas: { chave, file, url }
  const [categorias, setCategorias] = useState([])
  const [tipoDesconto, setTipoDesconto] = useState('preco') // 'preco' | 'percentual'
  const [percentual, setPercentual] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    api.listCategorias({ todas: true }).then(setCategorias)
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

  const escolherFotos = (e) => {
    const arquivos = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    setPendentes((p) => [...p, ...arquivos.map((file) => ({ chave: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))])
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
        ...(novo ? { ordem: 0 } : {}),
      })

      // fotos novas sobem depois que o produto existe (precisam do id)
      let ordem = imagens.length
      for (const p of pendentes) {
        const arquivo = await comprimirImagem(p.file)
        const img = await api.uploadImagemProduto(salvo.id, arquivo, ordem++)
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
                    {i > 0 && <button type="button" onClick={() => tornarCapa(img)} className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium text-magenta">Capa</button>}
                    <button type="button" onClick={() => removerSalva(img)} aria-label="Apagar foto" className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-vermelho"><IconeLixo className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {pendentes.map((p) => (
                <div key={p.chave} className="relative aspect-square overflow-hidden rounded-2xl ring-2 ring-dashed ring-ouro/60">
                  <img src={p.url} alt="" className="h-full w-full object-cover opacity-80" />
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-magenta">{salvando ? 'enviando…' : 'nova'}</span>
                  <button type="button" onClick={() => setPendentes((l) => l.filter((x) => x.chave !== p.chave))} aria-label="Tirar foto" className="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-vermelho"><IconeLixo className="h-4 w-4" /></button>
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
