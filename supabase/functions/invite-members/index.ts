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
console.log('Hello from Invite Members!')

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!

  const { members, property_id } = await req.json()
  if (!members || !property_id) {
    return new Response('Members and a property must be specified to invite', {
      headers: corsHeaders,
      status: 400,
    })
  }

  const { update } = await getUserPermissionsForProperty(
    authHeader,
    property_id
  )
  if (!update) {
    return new Response('Unauthorized access', {
      headers: corsHeaders,
      status: 403,
    })
  }
  console.log('invite members', members, 'to property', property_id)
  const { data: addedMembers } = await supaClient.rpc(
    'invite_members_to_property',
    {
      members,
      propertyid: property_id,
    }
  )

  console.log('successfully created members', addedMembers)

  console.log('maybe create a new filing')

  const { data: latestFiling } = await supaClient
    .from('property_filing')
    .select('(id,status)')
    .is('deleted', null)
    .eq('property_id', property_id)
    .order('created_at', { asc: 'false' })
  let potential_new_filing_id
  for (let i = 0; i < addedMembers.length; i++) {
    //this creates a filing if needed
    const { data } = await supaClient.rpc('update_user_filing', {
      _property_id: property_id,
      _userproperty_id: addedMembers[i],
    })
    if (i === 0) {
      console.log('filing id', data)
      potential_new_filing_id = data
    }
  }
  console.log('addedMembers', addedMembers)
  if (latestFiling[0].id !== potential_new_filing_id) {
    const { data: existing_members } = await supaClient
      .from('userproperty')
      .select('*, profiles(*), userproperty_filing(*)')
      .eq('property_id', property_id)
      .not('id', 'in', `(${addedMembers.join(',')})`)
      .is('deleted', null)
      .eq('userproperty_filing.propertyfiling_id', latestFiling[0].id)
    console.log('new filing was created, copy over data', existing_members)
    const to_insert = existing_members.map(existing_member => ({
      filingdata: existing_member.userproperty_filing[0].filingdata,
      userproperty_id: existing_member.id,
      propertyfiling_id: potential_new_filing_id,
      status: 'complete',
    }))
    //this copies over data for the new filing for anyone existing

    console.log('copy over any existing member info to new filing', to_insert)
    await supaClient.from('userproperty_filing').insert(to_insert)

    console.log('copy over the images', existing_members)
    for (let i = 0; i < existing_members.length; i++) {
      let user = existing_members[i]
      if (user.profiles.identification_url) {
        const { error } = await supaClient.storage
          .from('document_images')
          .copy(
            user.profiles.identification_url,
            `${property_id}/filing/${potential_new_filing_id}/${user.user_id}`
          )

        console.log('error copying images?', error)
      }
    }
  }
  console.log('email invites')
  // const existing_profiles = existing_members.map(({ profiles }) => profiles)
  // let customEmails = []
  for (let i = 0; i < members.length; i++) {
    let member = members[i]
    console.log('new profile, send invite email')
    await supaClient.functions.invoke('email', {
      body: { email: member.email },
    })
  }

  console.log('all done')
  return new Response(JSON.stringify({ addedMembers }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-members' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
