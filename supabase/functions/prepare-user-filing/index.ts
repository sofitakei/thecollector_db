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
    user_id,
    property_id,
    bucket,
    identification_url,
    filing_id,
    userproperty_id,
    ...rest
  } = await req.json()

  let allowedToUpdate = !property_id
  if (property_id && user_id) {
    const { update } = await getUserPermissionsForProperty(
      authHeader,
      property_id,
      user_id
    )
    allowedToUpdate = update
  }
  if (!allowedToUpdate) {
    return new Response(
      JSON.stringify({ message: 'not allowed to save user data' }),
      {
        headers: corsHeaders,
        status: 400,
      }
    )
  }

  const { error } = await supaClient.storage
    .from(bucket)
    .copy(identification_url, `${property_id}/filing/${filing_id}/${user_id}`)

  if (error && error !== null) {
    console.log('error copying image', error)
    if (error.message !== 'The resource already exists') {
      return new Response(JSON.stringify(error), {
        headers: corsHeaders,
        status: 400,
      })
    }
  }
  console.log('copied image to filing folder')

  const { data: upData, error: upError } = await supaClient
    .from('userproperty_filing')
    .update({ status: 'complete', filingdata: { user_id, ...rest } })
    .eq('userproperty_id', userproperty_id)
    .eq('status', 'open')
    .eq('propertyfiling_id', filing_id)

  if (upError && upError !== null) {
    console.log('error filing user information', upError)
    return new Response(JSON.stringify(upError), {
      headers: corsHeaders,
      status: 400,
    })
  }

  //TODO: send managers an email
  // const { data, error: emailError } = await supaClient.functions.invoke(
  //   'send-notification-email',
  //   {
  //     body: {
  //       notification_type: 'member-finish',
  //       property_id,
  //       users_to_email: [],
  //     },
  //   }
  // )
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
