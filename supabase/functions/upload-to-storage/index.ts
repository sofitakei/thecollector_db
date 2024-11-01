// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { decode } from 'npm:base64-arraybuffer'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  getUserPermissionsForProperty,
} from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from upload to storage!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!

  const { file, location, property_id, bucket, user_id } = await req.json()
  const base64 = file.split('base64,')[1]
  let allowedToUpdate = !property_id
  if (property_id) {
    const { update } = await getUserPermissionsForProperty(
      authHeader,
      property_id,
      user_id
    )
    allowedToUpdate = update
  }
  if (!allowedToUpdate) {
    return new Response(JSON.stringify({ message: 'not allowed to upload' }), {
      headers: corsHeaders,
      status: 400,
    })
  }

  const { data, error } = await supaClient.storage
    .from(bucket)
    .upload(location, decode(base64), {
      contentType: 'image/*',
      upsert: true,
    })

  if (error && error !== null) {
    console.log('error uploading image', error)
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 400,
    })
  }
  return new Response(JSON.stringify(data), {
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
