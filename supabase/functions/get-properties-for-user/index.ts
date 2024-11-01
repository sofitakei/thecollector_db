// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  getCurrentUser,
  getUserIsAdmin,
} from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from get properties for user!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!
  const { userProfile, user } = await getCurrentUser(authHeader)
  const isAdmin = await getUserIsAdmin(user?.id)
  console.log('is admin', isAdmin)
  let query = supaClient
    .from('userproperty')
    .select(
      '*, properties!inner(*, userproperty(property_role, userproperty_filing(*)), property_filing(*, payment(*))))'
    )
    .is('deleted', null)
    .is('properties.deleted', null)
    .is('properties.property_filing.payment.deleted', null)
    .eq('user_id', userProfile?.id)
  if (isAdmin) {
    query = supaClient
      .from('properties')
      .select(
        '*, userproperty(property_role,userproperty_filing(*)), property_filing(*, payment(*)))'
      )
      .is('deleted', null)
      .is('userproperty.deleted', null)
      .is('property_filing.payment.deleted', null)
  }
  const { data, error } = await query

  if (error !== null) {
    console.log('error retrieving properties', error)
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 400,
    })
  }

  return new Response(JSON.stringify(data), {
    headers: corsHeaders,
    status: 200,
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-properties-for-user' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
