# Stripe Setup

## Install
```bash
cd client
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Configure

Get keys from https://dashboard.stripe.com/test/apikeys

`server/.env`:
```
STRIPE_SECRET_KEY_FOR_TESTING=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

`client/.env`:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Test

Card: `4242 4242 4242 4242`
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits