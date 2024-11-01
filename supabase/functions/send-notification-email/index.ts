// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import { getCurrentUser } from '../_shared/supabase.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from send notification emails!')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_TIME = Deno.env.get('HOURS_BETWEEN_EMAILS')
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  //user_to_email should be a profiles record {id, email,notifications_on}
  const params = await req.json()
  const { users_to_email, notification_type, property_id } = params
  //const to_email, subject, html, text
  if (!users_to_email || !notification_type || !property_id) {
    const message = 'users and notification type is required'
    console.log(message)
    return new Response(JSON.stringify({ message }), {
      headers: corsHeaders,
      status: 400,
    })
  }
  console.log('get email template for', notification_type)
  const { data: template, error } = await supaClient
    .from('email_templates')
    .select('*')
    .eq('notification_type', notification_type)
  if (error !== null) {
    return new Response(JSON.stringify({ error }), {
      headers: corsHeaders,
      status: 400,
    })
  }
  if (template?.length === 0) {
    //template not found
    return new Response(JSON.stringify({ message: 'template not found' }), {
      headers: corsHeaders,
      status: 400,
    })
  }
  console.log('template found', template)
  const { template_html, template_subject } = template[0]
  let sender
  const authHeader = req.headers.get('Authorization')!
  try {
    const { userProfile } = await getCurrentUser(authHeader)
    const { data: up } = await supaClient
      .from('userproperty')
      .select('is_manager')
      .eq('user_id', userProfile?.id)
      .eq('property_id', property_id)

    const { data: roleData } = await supaClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userProfile?.id)
    sender = userProfile
    console.log('authorization check', userProfile, up, roleData)

    if (
      !up?.[0].is_manager &&
      roleData?.[0].role !== 'admin' &&
      notification_type !== 'request-manager-access'
    ) {
      const message = 'Not authorized'
      console.log(message)
      return new Response(JSON.stringify({ message }), {
        headers: corsHeaders,
        status: 400,
      })
    }
  } catch (err) {
    console.log('couldnt get user from JWT')
  }
  const { data: properties } = await supaClient
    .from('properties')
    .select('name')
    .eq('id', property_id)
  const property_name = properties?.[0]?.name

  //TODO: ?? check if the passed in users belong to this property

  //check if we recently sent this email
  var twoDaysAgo = new Date(
    Date.now() - EMAIL_TIME * 60 * 60 * 1000
  ).toISOString()
  const { data: emailsSent } = await supaClient
    .from('email_notifications')
    .select('user_id')
    .eq('notification_type', notification_type)
    .in(
      'user_id',
      users_to_email.map(({ id }) => id)
    )
    .gte('created_at', twoDaysAgo)

  const uniqueUsers = [...new Set(emailsSent?.map(({ user_id }) => user_id))]
  console.log(`emails already sent to these users`, uniqueUsers)

  //if the sender is a real human

  const forceSend = sender?.id !== undefined
  console.log('force send even if sent recently?', forceSend)
  const notSentUsers = forceSend
    ? users_to_email
    : users_to_email.filter(
        user => !uniqueUsers.includes(user.id) && user.notifications_on
      )
  console.log('email these people', notSentUsers, users_to_email)
  if (notSentUsers.length === 0) {
    return new Response(
      JSON.stringify({
        message: 'No emails to send, already sent too recently.',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  console.log(`Send to the following`, notSentUsers)

  console.log('generate login links for everyone')

  const usersWithLink = await Promise.all(
    notSentUsers.map(async profile => {
      const { email } = profile

      const { data, error } = await supaClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

      if (error !== null) {
        console.log(`error generating magic link for ${email}`)
      }
      console.log(`successfully created link`, data)
      return { ...profile, loginLink: data?.properties?.action_link }
    })
  )

  console.log('calling resend batch API', usersWithLink)

  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(
      usersWithLink.map(u => ({
        from: 'admin@filehoaboi.com',
        to: u.email,
        subject:
          template_subject.replace('{{ASSOCIATION}}', property_name) ||
          '(No subject)',
        html: template_html
          .replace('{{LOGIN_LINK}}', u.loginLink)
          .replace('{{ASSOCIATION}}', property_name)
          .replace('{{REQUESTOR}}', sender?.email),
      }))
    ),
  })

  const data = await res.json()

  await supaClient.from('email_notifications').insert(
    users_to_email.map(user => ({
      user_id: user.user_id,
      sent_by_user_id: sender ? sender.id : null,
      notification_type,
    }))
  )
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})
