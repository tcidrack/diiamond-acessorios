import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

/** Sessão do painel. `admin` só é true depois de conferir a tabela admins no banco. */
export function useAuth() {
  const [estado, setEstado] = useState({ carregando: true, usuario: null, admin: false })

  useEffect(() => {
    let ativo = true
    const conferir = async (usuario) => {
      const admin = usuario ? await api.souAdmin() : false
      if (ativo) setEstado({ carregando: false, usuario, admin })
    }
    api.getUsuario().then(conferir)
    // setTimeout: chamar o Supabase dentro do callback de auth trava o cliente
    const cancelar = api.onAuthChange((usuario) => setTimeout(() => conferir(usuario), 0))
    return () => {
      ativo = false
      cancelar()
    }
  }, [])

  return estado
}
