import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import { stripe } from './stripe.ts'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

export const createOrRetrieveStripeCustomer = async (authHeader: string) => {
  // Get JWT from auth header
  const jwt = authHeader.replace('Bearer ', '')
  // Get the user object
  const {
    data: { user },
  } = await supaClient.auth.getUser(jwt)
  if (!user) throw new Error('No user found for JWT!')

  // Check if the user already has a Stripe customer ID in the Database.
  const { data, error } = await supaClient
    .from('profiles')
    .select('stripe_customer_id')
    .eq('auth_user_id', user?.id)
  console.log(data?.length, data, error)
  if (error) throw error
  if (data?.length === 1 && data[0].stripe_customer_id !== null) {
    // Exactly one customer found, return it.
    const customer = data[0].stripe_customer_id
    console.log(`Found customer id: ${customer}`)
    return customer
  } else {
    // Create customer object in Stripe.
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { uid: user.id },
    })
    console.log(`New customer "${customer.id}" created for user "${user.id}"`)
    // Insert new customer into DB
    await supaClient
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('auth_user_id', user.id)
      .throwOnError()
    return customer.id
  }
}
