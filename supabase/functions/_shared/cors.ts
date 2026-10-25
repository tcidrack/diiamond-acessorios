export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function json(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
