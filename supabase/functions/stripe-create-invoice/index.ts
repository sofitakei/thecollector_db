// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import {
  corsHeaders,
  createOrRetrieveStripeCustomer,
} from '../_shared/supabase.ts'
import { stripe } from '../_shared/stripe.ts'

console.log('stripe-create-invoice!')
const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // create a new user
  const { priceId, product, property_filing_id, user_id } = await req.json()
  try {
    // Get the authorization header from the request.
    // When you invoke the function via the client library it will automatically pass the authenticated user's JWT.
    const authHeader = req.headers.get('Authorization')!

    // Retrieve the logged in user's Stripe customer ID or create a new customer object for them.
    // See ../_utils/supabase.ts for the implementation.
    const customerId = await createOrRetrieveStripeCustomer(authHeader)

    console.log('customer id is', customerId)

    console.log('create payment')
    const { data: paymentData, error } = await supaClient
      .from('payment')
      .insert({
        product,
        status: 'open',
        created_by_user_id: user_id,
        property_filing_id,
        method: 'stripe-invoice',
      })
      .select()
    if (error !== null) {
      console.log('error creating payment', error)
      return new Response(JSON.stringify(error), {
        headers: corsHeaders,
        status: 400,
      })
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: { payment_id: paymentData[0].id },
      // automatic_tax: { enabled: true }, TODO: need customer tax info to do this accurately
    })
    console.log('invoice created', invoice.id)

    const products = await stripe.products.list()

    const productPriceData = await stripe.prices.list({
      expand: ['data.product'], // 🎉 Give me the product data too
    })
    console.log('prices', productPriceData)

    const checkProcessingFee = productPriceData.data.find(
      ({ product: { name } }) => name === 'Check Processing Fee'
    )

    // Create an Invoice Item with the Price, and Customer you want to charge
    await stripe.invoiceItems.create({
      customer: customerId,
      price: checkProcessingFee.id,
      invoice: invoice.id,
    })
    await stripe.invoiceItems.create({
      customer: customerId,
      price: priceId,
      invoice: invoice.id,
    })

    // Send the Invoice
    await stripe.invoices.sendInvoice(invoice.id)

    // Return the customer details as well as teh Stripe publishable key which we have set in our secrets.
    const res = {
      stripe_pk: Deno.env.get('STRIPE_PUBLIC_KEY'),
      invoice_id: invoice.id,
      invoice_url: invoice.hosted_invoice_url,
      customer: customerId,
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
