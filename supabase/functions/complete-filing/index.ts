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
console.log('Hello from prepare user filing!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!

  const {
    last_updated_by_user_id,
    filing_type,
    filing,
    property_id,
    filing_id,
  } = await req.json()

  const { update } = await getUserPermissionsForProperty(
    authHeader,
    property_id
  )

  if (!update) {
    return new Response(JSON.stringify({ message: 'not allowed to save' }), {
      headers: corsHeaders,
      status: 400,
    })
  }

  const { data: upData, error: upError } = await supaClient
    .from('property_filing')
    .update({
      last_updated: new Date(),
      last_updated_by_user_id,
      status: 'complete',
      filing_type,
      filing,
    })
    .eq('id', filing_id)
    .select()

  if (upError && upError !== null) {
    console.log('error filing property information', upError)
    return new Response(JSON.stringify(upError), {
      headers: corsHeaders,
      status: 400,
    })
  }
  console.log('property_filing created', upData)
  supaClient.functions.invoke('generate-xml-data-for-filing', {
    body: {
      property_filing: upData[0],
    },
  })

  return new Response(JSON.stringify(upData), {
    headers: corsHeaders,
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-id-photo' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
