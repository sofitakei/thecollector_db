// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  getCurrentUser,
  getUserPermissionsForProperty,
} from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from save property!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { property_id, ...rest } = await req.json()
  const authHeader = req.headers.get('Authorization')!
  let allowedToUpdate = !property_id //new property so you can do whatever you want
  if (property_id) {
    const { update } = await getUserPermissionsForProperty(
      authHeader,
      property_id
    )
    allowedToUpdate = update
  }

  if (!allowedToUpdate) {
    return new Response(JSON.stringify({ message: 'not allowed to save' }), {
      headers: corsHeaders,
      status: 400,
    })
  }
  let savedPropertyId = property_id
  if (!property_id) {
    console.log('new property, add', rest)
    const { data } = await supaClient.rpc('add_property_with_owner', rest)

    savedPropertyId = data?.[0]?.id
    //if the person who added the property needs a report, create one here
    if (rest.property_role !== 'nonreporting') {
      console.log('create user filing for the property creator')
      const { data: filings } = await supaClient
        .from('property_filing')
        .select('id')
        .eq('property_id', savedPropertyId)

      const new_filing_id = filings?.[0]?.id
      const { userProfile } = await getCurrentUser(authHeader)
      console.log({ new_filing_id, userProfile })
      const { data: up } = await supaClient
        .from('userproperty')
        .select()
        .eq('property_id', savedPropertyId)
        .eq('user_id', userProfile?.id)

      console.log('new userproperty_filing', { up, new_filing_id })
      await supaClient.from('userproperty_filing').insert({
        status: 'open',
        userproperty_id: up[0]?.id,
        propertyfiling_id: new_filing_id,
      })
    }
  } else {
    const { created_by, property_role, ...propertyFields } = rest
    await supaClient
      .from('properties')
      .update(propertyFields)
      .eq('id', property_id)
      .select()

    console.log(
      'check if we need to create a new property filing',
      savedPropertyId
    )
    const { data: filings, error } = await supaClient
      .from('property_filing')
      .select('*, userproperty_filing(*)')
      .eq('property_id', savedPropertyId)
      .is('deleted', null)
      .is('userproperty_filing.deleted', null)
      .not('userproperty_filing.filingdata', 'is', null)
      .order('last_updated', { ascending: false })

    console.log('filing found', filings, 'error', error)
    if (filings?.length > 0) {
      const current_filing = filings?.[0]
      if (
        current_filing.status === 'complete' ||
        current_filing.status === 'filed'
      ) {
        console.log(
          'we have a completed filing, need to kick off a new one',
          current_filing
        )
        const { data: new_filing } = await supaClient
          .from('property_filing')
          .insert({
            property_id,
            status: 'open',
          })
          .select()

        console.log('new filing created', new_filing)
        const existing_completed_filings =
          current_filing.userproperty_filing.map(rec => ({
            filingdata: rec.filingdata,
            userproperty_id: rec.userproperty_id,
            propertyfiling_id: new_filing?.[0]?.id, //the new filing
            status: 'complete',
          })) //data from old filing

        console.log('copy these over', existing_completed_filings)

        const { data } = await supaClient
          .from('userproperty_filing')
          .insert(existing_completed_filings)
          .select()
        console.log('newly copied', data)

        for (let i = 0; i < existing_completed_filings.length; i++) {
          let existing_member = existing_completed_filings[i]

          console.log('copy images')
          if (existing_member.identification_url) {
            const { error } = await supaClient.storage
              .from('document_images')
              .copy(
                existing_member.identification_url,
                `${property_id}/filing/${new_filing?.[0]?.id}/${existing_member.user_id}`
              )

            console.log('error copying images?', error)
          }
        }
        const { userProfile } = await getCurrentUser(authHeader)
        //now save these back to the NEW filing
        const { data: updated_filing } = await supaClient
          .from('property_filing')
          .update({
            last_updated: new Date(),
            last_updated_by_user_id: userProfile?.id,
            filing: {
              ...current_filing.filing,
              property: propertyFields,
            },
          })
          .eq('id', new_filing?.[0]?.id)
          .select()
        console.log('property filing updated with user data', updated_filing)
      }
    }
  }

  return new Response(JSON.stringify({ savedPropertyId }), {
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
