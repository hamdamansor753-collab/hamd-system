const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_stripe_key_12345');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tenantId, tenantCode, hostUrl } = JSON.parse(req.body);

    if (!tenantId || !tenantCode) {
      res.status(400).json({ error: 'Missing tenantId or tenantCode' });
      return;
    }

    const baseDomain = hostUrl || 'https://hamd-system.vercel.app';

    // Mock response for testing/development if Stripe key is not configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_stripe_key_12345') {
      console.log("Stripe key is not set, generating mock checkout session");
      
      // In development, we can simulate checkout success by directing to success URL
      res.status(200).json({ 
        url: `${baseDomain}/app.html#settings?success=true&mock_payment=true&tenant_id=${tenantId}`
      });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'H.A.M.D SaaS — Pro Plan (الخطة الاحترافية)',
              description: 'أصناف غير محدودة، فواتير غير محدودة، ومستخدمين متعددين للمخازن والـ POS',
            },
            unit_amount: 2900, // $29.00 USD
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseDomain}/app.html#settings?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseDomain}/app.html#settings?success=false`,
      metadata: {
        tenantId: tenantId,
        tenantCode: tenantCode,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
