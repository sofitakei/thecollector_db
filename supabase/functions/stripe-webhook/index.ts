// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import Stripe from 'npm:stripe@17.2.1'

const stripe = Stripe(Deno.env.get('STRIPE_KEY'))
const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
console.log('Hello from Stripe Webhook!')

Deno.serve(async request => {
  const signature = request.headers.get('Stripe-Signature')

  // First step is to verify the event. The .text() method must be used as the
  // verification relies on the raw request body rather than the parsed JSON.
  const body = await request.text()

  let receivedEvent
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET'),
      undefined
    )
  } catch (err) {
    return new Response(err.message, { status: 400 })
  }
  // Secondly, we use this event to query the Stripe API in order to avoid
  // handling any forged event. If available, we use the idempotency key.
  const requestOptions =
    receivedEvent.request && receivedEvent.request.idempotency_key
      ? {
          idempotencyKey: receivedEvent.request.idempotency_key,
        }
      : {}
  console.log('get event from Stripe')
  let retrievedEvent
  try {
    retrievedEvent = await stripe.events.retrieve(
      receivedEvent.id,
      requestOptions
    )
    switch (receivedEvent.type) {
      case 'payment_intent.succeeded':
        await supaClient
          .from('payment')
          .update({
            stripe_payment_id: retrievedEvent.data.object.id,
            status: 'paid',
          })
          .eq('id', retrievedEvent.data.object.metadata.payment_id)

        return new Response(JSON.stringify(retrievedEvent), { status: 200 })

      case 'invoice.finalized':
        await supaClient
          .from('payment')
          .update({
            stripe_invoice_id: retrievedEvent.data.object.id,
          })
          .eq('id', retrievedEvent.data.object.metadata.payment_id)

        return new Response(JSON.stringify(retrievedEvent), { status: 200 })

      case 'invoice.paid':
        await supaClient
          .from('payment')
          .update({
            status: 'paid',
          })
          .eq('id', retrievedEvent.data.object.metadata.payment_id)

        return new Response(JSON.stringify(retrievedEvent), { status: 200 })

      default:
        return new Response(`Unhandled event ${receivedEvent.type}`, {
          status: 400,
        })
    }
  } catch (err) {
    console.log('error getting event', err.message)
    return new Response(err.message, { status: 400 })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/stripe-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
