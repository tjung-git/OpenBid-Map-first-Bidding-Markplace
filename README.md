# OpenBid: Map-first Bidding Marketplace

OpenBid is a **map-first bidding marketplace platform** developed by Team 1: Tyler, Mani, Yanness, Alaister.

## Features

- **Map-First Discovery**: Find jobs visually with Google Maps integration.
- **Real-Time Messaging**: Chat instantly with contractors or bidders using Socket.io.
- **Bidding System**: Detailed bid management and awarding workflow.
- **Role Switching**: Seamlessly toggle between Contractor and Bidder profiles.
- **Secure Auth**: Email/Password authentication with optional 2FA and KYC verification.

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Running in Prototype Mode - `PROTOTYPE=TRUE`

**No configuration required!** The application runs with in-memory mocks - no database, no `.env` files needed.

```bash
# From repo root
cd server && npm install
cd ../client && npm install

# Start backend
cd ../server
npm run dev

# Start the client
cd ../client
npm run dev
```

Visit `http://localhost:5173/` to access the application.

> **Note:** Prototype mode uses mock data and in-memory storage. All data is reset when the server restarts. This is the default mode for this iteration.

### Running in Production Mode - `PROTOTYPE=FALSE`

For full functionality with persistent data, email verification, and KYC, see the [Configuration](#configuration) section below.

> **Note:** Instructions for configuring KYC (Stripe), Duo (2FA), and Google Maps API keys will be provided in later iterations.

## Configuration

> **⚠️ Optional:** Only needed if running with `PROTOTYPE=FALSE`.

### Setups

- Firebase account
- Stripe account (for KYC - instructions in future iterations)
- Duo account (for 2FA - instructions in future iterations)
- Google Maps API key (for Google map display - instructions in future iterations)

### 1. Firebase Setup

1. Sign in at [https://console.firebase.google.com](https://console.firebase.google.com)
2. From **Project Overview** click **Add app** → **Web**
3. Enable **Email/Password** authentication in **Build → Authentication → Sign-in method**
4. Create a Firestore database in **Build → Firestore Database**

### 2. Server Environment (`server/.env`)

1. Navigate to **Project settings → Service accounts** and click **Generate new private key**
2. Copy `project_id`, `client_email`, and `private_key` values
3. Copy the `apiKey` from **Project settings → General**
4. Create `server/.env` with:

   ```ini
   PROTOTYPE=FALSE
   PORT=4000
   FIREBASE_PROJECT_ID=<project_id>
   FIREBASE_CLIENT_EMAIL=<client_email>
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_WEB_API_KEY=<firebase web api key>
   APP_URL=http://localhost:5173
   EMAIL_VERIFICATION_REDIRECT=http://localhost:5173/login
   APP_NAME=OpenBid
   ```

### 3. Client Environment (`client/.env`)

Create `client/.env` with:

```ini
VITE_PROTOTYPE=FALSE
VITE_API_BASE=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=<google_map_api_key>
```

### Email Verification & KYC

- Firebase sends verification emails automatically during signup
- Use [temp-mail.org](https://temp-mail.org/en/) for testing
- Login is blocked until email is verified

## Running Tests

```bash
# Client tests
cd client
npm test

# Server tests
cd server
npm test
```

### Switching Between Modes

**Prototype Mode (default):**
- No `.env` files needed
- Uses in-memory mocks
- Data resets on server restart
- Ideal for development and testing

**Firebase Mode:**
- Requires `.env` configuration (see [Configuration](#configuration))
- Set `PROTOTYPE=FALSE` in both `server/.env` and `VITE_PROTOTYPE=FALSE` in `client/.env`
- Uses real Firebase backend
- Persistent data storage

## Documentation

- [LaTeX Setup Guide](documentation/LATEX_SETUP.md) - Instructions for compiling project proposal documents
- Project proposals available in the `documentation/` folder
