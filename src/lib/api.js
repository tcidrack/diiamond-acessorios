import { MODO_DEMO } from './supabase.js'
import { apiSupabase } from './api-supabase.js'
import { apiDemo } from './api-demo.js'

/** Ponto único de acesso a dados. As telas nunca falam com o Supabase direto. */
export const api = MODO_DEMO ? apiDemo : apiSupabase
