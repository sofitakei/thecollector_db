// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  maybeCreateErrorResponse,
  getUserPermissionsForProperty,
  getCurrentUser,
} from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from get users for property!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { property_id } = await req.json()
  const authHeader = req.headers.get('Authorization')!

  const { read, update } = await getUserPermissionsForProperty(
    authHeader,
    property_id
  )
  if (!read) {
    console.log('error retrieving users for property')
    return new Response(JSON.stringify({ message: 'not authorized' }), {
      headers: corsHeaders,
      status: 400,
    })
  }

  const { data: properties, perror } = await supaClient
    .from('properties')
    // .select()
    .select(
      `*,states(*),country_jurisdiction:countries!country_jurisdiction_id(*), property_filing!property_id(*, payment(*)))`
    )
    .is('deleted', null)
    .eq('id', property_id)
    .is('property_filing.payment.deleted', null)
  if (perror && perror !== null) {
    console.log('error retrieving property', perror)
    return new Response(JSON.stringify(perror), {
      headers: corsHeaders,
      status: 400,
    })
  } else if ((properties && properties?.length === 0) || properties === null) {
    console.log('property not found')
    return new Response(JSON.stringify({ data: [] }), {
      headers: corsHeaders,
      status: 200,
    })
  }

  const currentProperty = properties?.[0]
  const latest_filing = currentProperty?.property_filing?.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )?.[0]

  console.log('currentProperty', currentProperty)
  const { data, error } = await supaClient
    .from('userproperty')
    .select(
      `*,
      userproperty_filing(*),
      profiles(*, document_jurisdiction_local_tribal:local_tribal!document_jurisdiction_local_tribal_id(*), state:states!state_id(*), document_state:states!document_state_id(*), country_jurisdiction:countries!country_jurisdiction_id(*),document_country_jurisdiction:countries!document_country_jurisdiction_id(*) )`
    )
    .eq('property_id', property_id)
    .eq('userproperty_filing.propertyfiling_id', latest_filing?.id)
    .is('deleted', null)

  const errorResponse = maybeCreateErrorResponse(error, {
    message: 'error retrieving users for property',
  })

  if (errorResponse) {
    return errorResponse
  }

  const { userProfile } = await getCurrentUser(authHeader)

  const filteredData = data.map(user => {
    const { id, profiles, is_manager, property_role, userproperty_filing } =
      user
    return profiles.id === userProfile.id
      ? user
      : {
          id,
          is_manager,
          property_role,
          profiles: {
            id: profiles.id,
            first_name: profiles.first_name,
            last_name: profiles.last_name,
            email: profiles.email,
          },
          userproperty_filing: userproperty_filing.map(
            ({ filingdata, ...rest }) => rest
          ),
        }
  })

  //if we only have read but no update permissions, we can truncate the data returned
  return new Response(
    JSON.stringify({ data: update ? data : filteredData, currentProperty }),
    {
      headers: corsHeaders,
      status: 200,
    }
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-properties-for-user' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
