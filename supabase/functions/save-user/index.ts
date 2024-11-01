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
} from '../_shared/supabase.ts'

console.log('Hello from Save users!')

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!

  const {
    user,
    property_id,
    property_role,
    userproperty_id,
    current_filing_id,
  } = await req.json()

  const { update } = await getUserPermissionsForProperty(
    authHeader,
    property_id,
    user?.id
  )
  if (!update) {
    return new Response('Unauthorized access', {
      headers: corsHeaders,
      status: 403,
    })
  }

  console.log(
    'check if this email already exists if we dont have a user id coming in'
  )
  let existing_user_id = user?.id
  if (!existing_user_id && user.email) {
    const { data } = await supaClient
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .is('deleted', null)
    if (data?.length === 1) {
      existing_user_id = data[0].id
      console.log('existing user found', existing_user_id)
    }
  }
  console.log('save to profiles', user)
  const { data } = await supaClient
    .from('profiles')
    .upsert({ ...user, id: existing_user_id })
    .select()

  const userId = data?.[0]?.id

  if (!userId) {
    return new Response(
      JSON.stringify({ message: 'could not save user', user }),
      {
        headers: corsHeaders,
        status: 400,
      }
    )
  }

  //if no property_id was passed in, we just needed to save the profile, done
  if (!property_id) {
    return new Response(JSON.stringify({ message: 'user saved', userId }), {
      headers: corsHeaders,
      status: 200,
    })
  }

  console.log('now save user to the property', data, userId, existing_user_id)

  const idParam = userproperty_id ? { id: userproperty_id } : {}
  const { data: upData, error: upError } = await supaClient
    .from('userproperty')
    .upsert({
      ...idParam,
      user_id: userId,
      property_id,
      property_role,
    })
    .select()

  if (upError && upError !== null) {
    console.log('error associating user to property', upError)
    return new Response(
      JSON.stringify({
        message: 'could not save user to property',
        user,
        property_id,
      }),
      {
        headers: corsHeaders,
        status: 400,
      }
    )
  }

  console.log(
    'now create a filing for the user if needed, and also a new property filing if needed'
  )

  const { data: filing_id } = await supaClient.rpc('update_user_filing', {
    _property_id: property_id,
    _userproperty_id: upData[0].id,
  })

  console.log('new filing id', filing_id, current_filing_id)

  if (filing_id !== current_filing_id) {
    console.log(
      'get current filing and see if we need to copy over other users'
    )
    const { data: filings, error: filingsError } = await supaClient
      .from('property_filing')
      .select('*, userproperty_filing(*)')
      .eq('id', current_filing_id)
      .eq('userproperty_filing.status', 'complete')
      .not('userproperty_filing.filingdata', 'is', null) //this should never happen though

    const e = maybeCreateErrorResponse(filingsError, {
      message: 'error getting filings',
    })
    if (e) return e

    const existing_completed_filings = filings?.[0]?.userproperty_filing //data from old filing
    //this copies over data for the new filing for anyone existing
    const to_insert = existing_completed_filings.map(u => ({
      filingdata: u.filingdata,
      userproperty_id: u.userproperty_id,
      propertyfiling_id: filing_id, //the new filing
      status: 'complete',
    }))

    console.log('copy over any existing member info to new filing', to_insert)

    await supaClient.from('userproperty_filing').insert(to_insert)

    for (let i = 0; i < existing_completed_filings.length; i++) {
      let existing_member = existing_completed_filings[i]

      console.log('copy images')
      if (existing_member.identification_url) {
        const { error } = await supaClient.storage
          .from('document_images')
          .copy(
            existing_member.identification_url,
            `${property_id}/filing/${filing_id}/${existing_member.user_id}`
          )

        console.log('error copying images?', error)
      }
    }
  }
  console.log('all done')
  return new Response(
    JSON.stringify({ message: 'succesfully saved user', userId, filing_id }),
    {
      headers: corsHeaders,
      status: 200,
    }
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-members' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
