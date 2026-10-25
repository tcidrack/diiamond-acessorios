import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo.jsx'
import { Erro } from '../../components/admin/UI.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../lib/api.js'
import { MODO_DEMO } from '../../lib/supabase.js'
import { destravarSom } from '../../lib/alerta.js'

export default function Login() {
  const { usuario, admin } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  if (usuario && admin) return <Navigate to="/admin" replace />

  const entrar = async (e) => {
    e.preventDefault()
    destravarSom() // aproveita o clique para liberar o som dos alertas
    setErro('')
    setEntrando(true)
    try {
      await api.login(email.trim(), senha)
      navegar('/admin', { replace: true })
    } catch (err) {
      setErro(err.message)
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={entrar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="-mx-6 -mt-6 mb-2 flex items-center gap-3 rounded-t-3xl bg-brand-gradient px-6 py-5 text-white">
          <Logo className="h-12 w-12" />
          <div>
            <p className="font-display text-xl">Diiamond Acessórios</p>
            <p className="text-xs text-ouro-claro/80">painel da loja</p>
          </div>
        </div>
        {MODO_DEMO && <p className="rounded-xl bg-ambar-bg px-3 py-2 text-xs text-ambar">Modo demonstração: use qualquer e-mail e a senha <strong>demo</strong>.</p>}
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="campo" />
        </label>
        <Erro>{erro}</Erro>
        <button type="submit" disabled={entrando} className="btn-primario w-full">{entrando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
