// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/supabase.ts'
import { stripe } from '../_shared/stripe.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

console.log('Hello from Stripe Checkout!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { product, priceId, user_id, url, property_id } = await req.json()

  const YOUR_DOMAIN = url
  try {
    console.log('create payment')

    const { data, error } = await supaClient
      .from('payment')
      .insert({
        product,
        status: 'open',
        created_by_user_id: user_id,
        property_id,
        method: 'stripe-checkout',
      })
      .select()
    if (error !== null) {
      console.log('error creating payment', error)
      return new Response(JSON.stringify(error), {
        headers: corsHeaders,
        status: 400,
      })
    }
    console.log('payment created', data)
    console.log('create session')
    const session = await stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: { property_id, payment_id: data[0].id },
      },
      line_items: [
        {
          // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${YOUR_DOMAIN}/properties/${property_id}/payment-success`,
      cancel_url: `${YOUR_DOMAIN}/properties/${property_id}/payment-error`,
    })
    console.log('session created', session)

    console.log('update payment with session')
    const { error: updateError } = await supaClient
      .from('payment')
      .update({
        stripe_session_id: session.id,
      })
      .eq('id', data[0].id)
    if (updateError !== null) {
      console.log('error updating payment', error)
      return new Response(JSON.stringify(error), {
        headers: corsHeaders,
        status: 400,
      })
    }
    return new Response(JSON.stringify({ session }), {
      headers: corsHeaders,
      status: 200,
    })
  } catch (error) {
    console.log('error creating session', error)
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
