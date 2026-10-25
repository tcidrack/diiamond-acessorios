import { useEffect, useState } from 'react'
import { Campo, CampoSenha, Erro, Titulo, Toggle, useAviso } from '../../components/admin/UI.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../lib/api.js'
import { numeroParaCampo, parseBRL } from '../../lib/format.js'

export default function Configuracoes() {
  const [cfg, setCfg] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useAviso()

  useEffect(() => {
    api.getConfig().then((c) => setCfg({ ...c, pedido_minimo: numeroParaCampo(c.pedido_minimo) })).catch((e) => setErro(e.message))
  }, [])

  if (!cfg) return <p className="text-sm text-magenta/40">{erro || 'Carregando…'}</p>

  const set = (chave) => (e) => setCfg((c) => ({ ...c, [chave]: e?.target ? e.target.value : e }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const { id, updated_at, ...campos } = cfg
      const salvo = await api.salvarConfig({
        ...campos,
        whatsapp: String(campos.whatsapp || '').replace(/\D/g, ''),
        instagram: String(campos.instagram || '').replace(/^@/, '').trim(),
        pedido_minimo: parseBRL(campos.pedido_minimo) ?? 0,
      })
      setCfg({ ...salvo, pedido_minimo: numeroParaCampo(salvo.pedido_minimo) })
      setAviso('Configurações salvas!')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <form onSubmit={salvar} className="space-y-4">
        {aviso}
        <Titulo acao={<button type="submit" disabled={salvando} className="btn-primario">{salvando ? 'Salvando…' : 'Salvar'}</button>}>Configurações</Titulo>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold text-magenta">Loja</h2>
            <Toggle ativo={cfg.aberta} onChange={set('aberta')} rotulo={cfg.aberta ? 'Aceitando pedidos' : 'Fechada para pedidos'} />
            <Campo rotulo="Nome da loja"><input value={cfg.nome || ''} onChange={set('nome')} className="campo" /></Campo>
            <Campo rotulo="Frase abaixo do nome"><input value={cfg.slogan || ''} onChange={set('slogan')} className="campo" /></Campo>
            <Campo rotulo="WhatsApp da loja (com DDD)" ajuda="Para onde chegam os pedidos e as dúvidas.">
              <input type="tel" value={cfg.whatsapp || ''} onChange={set('whatsapp')} className="campo" placeholder="61999999999" />
            </Campo>
            <Campo rotulo="Instagram"><input value={cfg.instagram || ''} onChange={set('instagram')} className="campo" placeholder="diiamondacessorios" /></Campo>
            <Campo rotulo="Horário de atendimento"><input value={cfg.horario || ''} onChange={set('horario')} className="campo" placeholder="Seg a sáb, 9h às 19h" /></Campo>
            <Campo rotulo="Local de retirada" ajuda="Aparece para quem escolhe retirar."><input value={cfg.endereco_retirada || ''} onChange={set('endereco_retirada')} className="campo" /></Campo>
            <Campo rotulo="Pedido mínimo (R$)" ajuda="0 = sem mínimo."><input inputMode="decimal" value={cfg.pedido_minimo} onChange={set('pedido_minimo')} className="campo" /></Campo>
            <Campo rotulo="Endereço do site" ajuda="Usado pela IA para mandar links de produtos. Ex.: https://diamondacessorios.com.br">
              <input value={cfg.url_loja || ''} onChange={set('url_loja')} className="campo" placeholder={window.location.origin} />
            </Campo>
          </section>

          <div className="space-y-4">
            <section className="card space-y-4 p-5">
              <h2 className="font-display text-lg font-semibold text-magenta">Faixa de aviso no topo</h2>
              <Toggle ativo={cfg.banner_ativo} onChange={set('banner_ativo')} rotulo="Mostrar faixa" />
              <Campo rotulo="Texto"><input value={cfg.banner_texto || ''} onChange={set('banner_texto')} className="campo" placeholder="Frete grátis acima de R$ 100" /></Campo>
            </section>

            <section className="card space-y-4 p-5">
              <h2 className="font-display text-lg font-semibold text-magenta">Pix</h2>
              <Campo rotulo="Chave Pix" ajuda="CPF, CNPJ, e-mail, celular ou chave aleatória."><input value={cfg.chave_pix || ''} onChange={set('chave_pix')} className="campo" /></Campo>
              <Campo rotulo="Nome do recebedor" ajuda="Como aparece no banco (sem acentos tudo bem)."><input value={cfg.pix_nome || ''} onChange={set('pix_nome')} className="campo" /></Campo>
              <Campo rotulo="Cidade do recebedor"><input value={cfg.pix_cidade || ''} onChange={set('pix_cidade')} className="campo" /></Campo>
            </section>
          </div>
        </div>
        <Erro>{erro}</Erro>
      </form>
      <AlterarSenha />
    </>
  )
}

function AlterarSenha() {
  const { usuario } = useAuth()
  const [campos, setCampos] = useState({ atual: '', nova: '', repetir: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useAviso()

  const set = (chave) => (e) => setCampos((c) => ({ ...c, [chave]: e.target.value }))

  const alterar = async (e) => {
    e.preventDefault()
    setErro('')
    if (campos.nova.length < 8) return setErro('A nova senha precisa ter pelo menos 8 caracteres.')
    if (campos.nova !== campos.repetir) return setErro('As duas novas senhas não são iguais.')
    if (campos.nova === campos.atual) return setErro('A nova senha precisa ser diferente da atual.')
    setSalvando(true)
    try {
      await api.alterarSenha(campos.atual, campos.nova)
      setCampos({ atual: '', nova: '', repetir: '' })
      setAviso('Senha alterada!')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={alterar} className="card mt-4 space-y-4 p-5 lg:max-w-[calc(50%-0.5rem)]">
      {aviso}
      <div>
        <h2 className="font-display text-lg font-semibold text-magenta">Senha de acesso</h2>
        <p className="mt-0.5 text-xs text-magenta/55">Troca a senha do login que está usando agora{usuario?.email ? <> ({usuario.email})</> : null}.</p>
      </div>
      <Campo rotulo="Senha atual"><CampoSenha required autoComplete="current-password" value={campos.atual} onChange={set('atual')} /></Campo>
      <Campo rotulo="Nova senha" ajuda="Pelo menos 8 caracteres."><CampoSenha required autoComplete="new-password" value={campos.nova} onChange={set('nova')} /></Campo>
      <Campo rotulo="Repetir nova senha"><CampoSenha required autoComplete="new-password" value={campos.repetir} onChange={set('repetir')} /></Campo>
      <Erro>{erro}</Erro>
      <button type="submit" disabled={salvando} className="btn-claro w-full sm:w-auto">{salvando ? 'Alterando…' : 'Alterar senha'}</button>
    </form>
  )
}
