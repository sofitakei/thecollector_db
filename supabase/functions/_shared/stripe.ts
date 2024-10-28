// esm.sh is used to compile stripe-node to be compatible with ES modules.
import Stripe from 'npm:stripe@^11.16'

export const stripe = Stripe(Deno.env.get('STRIPE_KEY') ?? '', {
  // This is needed to use the Fetch API rather than relying on the Node http
  // package.
  httpClient: Stripe.createFetchHttpClient(),
})
