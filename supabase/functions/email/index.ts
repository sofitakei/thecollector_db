// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

console.log('Hello from Functions!')

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // create a new user
  const { email } = await req.json()

  console.log(`Signing up new user init - ${JSON.stringify(req)}`)

  const { data, error } = await supaClient.auth.admin.createUser({
    email,
  })

  console.log(`Response from sign up - ${JSON.stringify(data)}`)

  if (error) {
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 500,
    })
  }

  const { data: inviteUserData, error: inviteUserError } =
    await supaClient.auth.admin.inviteUserByEmail(email)

  if (inviteUserError) {
    return new Response(JSON.stringify(inviteUserError), {
      headers: corsHeaders,
      status: 500,
    })
  }

  return new Response(JSON.stringify(inviteUserData.user), {
    headers: corsHeaders,
    status: 200,
  })
})
