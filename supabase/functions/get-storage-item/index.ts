// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  getUserPermissionsForProperty,
} from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from get from storage!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!

  const { path, property_id, bucket } = await req.json()

  let allowedToRead = !property_id
  if (property_id) {
    const { read } = await getUserPermissionsForProperty(
      authHeader,
      property_id
    )
    allowedToRead = read
  }
  if (!allowedToRead) {
    return new Response(
      JSON.stringify({ message: 'not allowed to download' }),
      {
        headers: corsHeaders,
        status: 400,
      }
    )
  }

  const { data, error } = await supaClient.storage.from(bucket).download(path)

  if (error && error !== null) {
    console.log('error getting image', error)
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 400,
    })
  }
  console.log('storage item successful', data)
  const buffer = await data.arrayBuffer()
  return new Response(buffer, {
    headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream' },
    status: 200,
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-storage-item' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
