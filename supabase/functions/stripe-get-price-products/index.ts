// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/supabase.ts'
import { stripe } from '../_shared/stripe.ts'

console.log('stripe-get-prices!')

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const productPriceData = await stripe.prices.list({
      expand: ['data.product'], // 🎉 Give me the product data too
    })
    console.log('prices', productPriceData)

    // Return the customer details as well as teh Stripe publishable key which we have set in our secrets.
    const res = {
      productPriceData,
    }
    return new Response(JSON.stringify(res), {
      headers: corsHeaders,
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify(error), {
      headers: corsHeaders,
      status: 400,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/stripe-create-invoice' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
