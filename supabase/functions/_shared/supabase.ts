import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Cliente com service role: ignora RLS. Só usar dentro das functions. */
export function clienteServico(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

/** Confere se quem chamou está logado E está na tabela admins. */
export async function exigirAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return false
  const db = clienteServico()
  const { data } = await db.auth.getUser(token)
  if (!data.user) return false
  const { data: admin } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle()
  return !!admin
}
