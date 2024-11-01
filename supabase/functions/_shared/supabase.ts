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

//only admins and managers can change things in a property
//if you're a member, you can read
export const getUserPermissionsForProperty = async (
  authHeader: string,
  propertyId: number,
  userToUpdateId?: number
) => {
  // Get JWT from auth header
  const jwt = authHeader.replace('Bearer ', '')
  // Get the user object
  const {
    data: { user },
  } = await supaClient.auth.getUser(jwt)
  if (!user) throw new Error('No user found for JWT!')
  //check if user is admin, they can do anything
  const { data: roleData } = await supaClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user?.id)

  if (roleData?.length && roleData?.[0].role === 'admin') {
    return { update: true, read: true }
  }
  // Check if the user exists
  const { data, error } = await supaClient
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user?.id)

  if (error) throw error
  if (data?.length === 1) {
    console.log('profile found', data[0])
    const userId = data[0].id
    // Check if the user is part of this property
    const { data: propertyData } = await supaClient
      .from('userproperty')
      .select('id,is_manager, properties!inner(deleted)')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .is('deleted', null)
      .is('properties.deleted', null)

    console.log('Got property data', propertyData)
    if (propertyData?.length === 0) {
      return { read: false, update: false }
    }

    const updateMyself = userToUpdateId
      ? `${userToUpdateId}` === `${userId}`
      : false
    console.log('updating my own profile?', updateMyself)
    //you can see data if you're not a manager but not update
    return {
      read: true,
      update: updateMyself || propertyData?.[0].is_manager,
    }
  } else {
    return { update: false, read: false }
  }
}

export const getCurrentUser = async (authHeader: string) => {
  // Get JWT from auth header
  const jwt = authHeader?.replace('Bearer ', '')
  // Get the user object
  const {
    data: { user },
  } = await supaClient.auth.getUser(jwt)
  if (!user) throw new Error('No user found for JWT!')

  // Check if the user already has a Stripe customer ID in the Database.
  const { data: userProfile } = await supaClient
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user?.id)
  console.log('got user profile', userProfile)
  return { user, userProfile: userProfile?.[0] }
}

export const getUserIsAdmin = async (auth_user_id: number) => {
  const { data: roleData } = await supaClient
    .from('user_roles')
    .select('role')
    .eq('user_id', auth_user_id)
  return roleData?.[0]?.role === 'admin'
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

export const maybeCreateErrorResponse = (error, args) => {
  if (error && error !== null) {
    console.log(error, args)
    return new Response(JSON.stringify({ ...args, error }), {
      headers: corsHeaders,
      status: 400,
    })
  }
}
