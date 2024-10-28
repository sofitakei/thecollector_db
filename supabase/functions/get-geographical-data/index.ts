// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/supabase.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

console.log('Hello from get-geographical data!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('get data for countries, tribes, and states')

    const { data: countries, error } = await supaClient
      .from('countries')
      .select()
    if (error !== null) {
      console.log('error getting countries', error)
      return new Response(JSON.stringify(error), {
        headers: corsHeaders,
        status: 400,
      })
    }

    const { data: tribes, error: tribal_error } = await supaClient
      .from('local_tribal')
      .select()
    if (error !== null) {
      console.log('error getting local_tribal', tribal_error)
      return new Response(JSON.stringify(tribal_error), {
        headers: corsHeaders,
        status: 400,
      })
    }

    const { data: states, error: states_error } = await supaClient
      .from('states')
      .select()
    if (error !== null) {
      console.log('error getting states', states_error)
      return new Response(JSON.stringify(states_error), {
        headers: corsHeaders,
        status: 400,
      })
    }

    return new Response(
      JSON.stringify({
        countries,
        local_tribal: tribes,
        states: states,
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    )
  } catch (error) {
    console.log('error getting geography data', error)
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 400,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-stripe-checkout' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
