import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Sem as variáveis de ambiente o site roda em modo demonstração (src/lib/api-demo.js). */
export const MODO_DEMO = !url || !anonKey

export const supabase = MODO_DEMO
  ? null
  : createClient(url, anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
