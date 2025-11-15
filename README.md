# OpenBid: Map-first Bidding Marketplace

OpenBid is a map-first bidding marketplace platform developed by Team 1: Tyler, Mani, Yanness, Alaister.

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account

### Installation & Running the Application

```bash
# From repo root
cd server && npm install
cd ../client && npm install

# Start backend (needs Firebase env vars set)
cd ../server
npm run dev

# In a new terminal start the client
cd ../client
npm run dev
```

Visit `http://localhost:5173/` to access the application.

## Configuration

### 1. Firebase Setup

1. Sign in at [https://console.firebase.google.com](https://console.firebase.google.com)
2. From **Project Overview** click **Add app** → **Web**
3. Enable **Email/Password** authentication in **Build → Authentication → Sign-in method**
4. Create a Firestore database in **Build → Firestore Database** (Native mode)
5. Set Firestore security rules:

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null && request.auth.uid != null;
       }
     }
   }
   ```

### 2. Server Environment (`server/.env`)

1. Navigate to **Project settings → Service accounts** and click **Generate new private key**
2. Copy `project_id`, `client_email`, and `private_key` values
3. Copy the `apiKey` from **Project settings → General**
4. Update `server/.env`:

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

```ini
VITE_PROTOTYPE=FALSE
VITE_API_BASE=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=<optional>
```

## Email Verification & KYC

- Firebase sends verification emails automatically during signup
- Use [temp-mail.org](https://temp-mail.org/en/) for testing
- Login is blocked until email is verified
- **Testing note:** Manually set `kycStatus` to `verified` in Firestore to simulate KYC approval

## Development

### Running Tests

```bash
# Client tests
cd client
npm test

# Server tests
cd server
npm test
```

### Prototype Mode

Set `PROTOTYPE=TRUE` in `server/.env` to use in-memory mocks (no Firebase required).

## Documentation

- [LaTeX Setup Guide](documentation/LATEX_SETUP.md) - Instructions for compiling project proposal documents
- Project proposals available in the `documentation/` folder
