// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

console.log('Hello from Resend!')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
Deno.serve(async req => {
  console.log('resend API')
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { from_email, to_email, subject, html, text } = await req.json()

  if (!to_email || !html || !subject) {
    const message = 'to field, email body, and subject are required'
    console.log(message)
    return new Response(JSON.stringify({ message }), {
      headers: corsHeaders,
      status: 400,
    })
  }
  console.log('calling resend API')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: from_email || 'admin@filehoaboi.com',
      to: to_email || 'delivered@resend.dev',
      subject: subject || '(No subject)',
      html,
      text,
    }),
  })

  const data = await res.json()

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})
