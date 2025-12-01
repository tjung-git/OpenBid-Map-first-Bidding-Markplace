# OpenBid: Map-first Bidding Marketplace

OpenBid is a **map-first bidding marketplace platform** developed by Team 1: Tyler, Mani, Yanness, Alaister.

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

> **Optional:** Only needed if running with `PROTOTYPE=FALSE`.

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
- With `PROTOTYPE=TRUE` the backend falls back to in-memory mocks (no Firebase, no email). Keep it `FALSE` for the real stack.
- Visit `http://localhost:5173/` to access the login page.


## Serverless Deployment (Firebase Hosting + Cloud Functions)

This section layers the production-ready serverless workflow on top of the existing prototype instructions.

### Architecture Overview
- **Frontend** (Vite) is built to `client/dist` and deployed to Firebase Hosting (`openbid2107`). `firebase.json` rewrites `/api/**` to the backend function and serves the SPA for every other route.
- **Backend API** reuses the existing Express app. `server/src/app.serverless.js` exports the app without calling `app.listen()`.
- **Cloud Function** (`functions/index.js`) loads environment variables via `dotenv`, injects them into `process.env`, lazy-loads the Express app, and handles each HTTPS request.
- **CI/CD**: `.github/workflows/deploy-live.yml` builds the client, installs Cloud Function deps, and deploys Hosting + Functions whenever the `live` branch updates (requires a `FIREBASE_TOKEN` repo secret).

### Repository Additions
- `server/src/app.serverless.js` – serverless-compatible Express factory.
- `firebase.json` / `.firebaserc` – Hosting + Functions config with rewrite rules.
- `functions/index.js` – HTTPS function that loads environment variables (via `dotenv`) and returns the Express app’s response.
- `functions/scripts/prepare-server.mjs` – predeploy script that copies `server/` into `functions/server/` so the Express code is available as a local dependency during Cloud Build installs.
- `.github/workflows/deploy-live.yml` – Deploys on merges to `live`.

### Step-by-step Checklist

**Step 0 – Local prerequisites**
- Node.js 18+ (the function runs on Node 20; use `nvm use 20` if you have multiple versions installed).
- npm 9+ (bundled with Node 20).
- A Google account with access to the Firebase project `openbid2107`.

**Step 1 – Install the Firebase CLI (one time per machine)**
```bash
npm install -g firebase-tools
firebase --version
```
The version should be ≥ 12. If you receive a permission error on macOS/Linux, prepend `sudo` or use a Node version manager.

**Step 2 – Authenticate and set the default project**
```bash
firebase login
firebase use --add
```
During `firebase use --add`, pick **openbid2107** from the list when prompted and accept the suggested alias `default`. This ensures every deploy command targets the correct Firebase project.

**Step 3 – (First-time only) run `firebase init`**
If you are starting from a fresh clone, initialize Firebase features so that the CLI creates the `.firebaserc` entry and links Hosting/Functions:
```bash
firebase init
```
Choose the options below when the CLI prompts you:
- **Which features?** Use the spacebar to select **Functions** and **Hosting** (leave the others unchecked). Press Enter.
- **Use an existing project?** Select **openbid2107**.
- **Functions language?** JavaScript.
- **Use ESLint?** No (already handled).
- **Install dependencies now?** Yes.
- **Functions directory?** `functions`
- **Hosting public directory?** `client/dist`
- **Configure as a single-page app (rewrite all urls to /index.html)?** Yes.
- **Set up automatic builds and deploys with GitHub?** No (we provide our own workflow).
- **Overwrite existing files?** Choose **No** for any prompt that would overwrite tracked files—this repo already contains the correct configuration.

> The repository already includes `firebase.json`, `.firebaserc`, `server/src/app.serverless.js`, and `functions/index.js`. These files are hand-written (not auto-generated) and should stay exactly as committed. Running `firebase init` on top of them with “do not overwrite” ensures the CLI registers the project without clobbering our custom code.

**Step 4 – Install dependencies locally**
```bash
npm install --prefix server
npm install --prefix client
npm --prefix functions run copy-server
npm install --prefix functions
```
The `copy-server` script duplicates the `server/` source into `functions/server/` (excluding `node_modules`). This lets Firebase bundle the Express code as a local dependency when it runs `npm install` in the deployment build.
The `functions` install pulls in `openbid-server` via the local `file:../server` package so the deployed function can import the Express app.

**Step 5 – Configure environment variables**
- **Production (Cloud Run)** – If you've already defined the variables inside Google Cloud Run (`Cloud Run → Services → api → Variables & Secrets`, as shown in the screenshot), you're done. Deployments keep those values and the function reads them directly from `process.env`.
- **Local development / emulators** – Copy the templates so you can run the API on your laptop:
  ```bash
  cp server/.env.example server/.env
  cp functions/.env.example functions/.env    # optional: only used when running emulators or when you prefer bundling envs with the deploy
  ```
  Fill in the same values you use in Cloud Run—especially `PROTOTYPE`, `APP_URL`, and the Firebase admin credentials. Keep these files out of git.

**Step 6 – Optional local verification**
- Backend: `npm run dev --prefix server`
- Frontend: `npm run dev --prefix client` (override `VITE_API_BASE` in `client/.env.local` to hit `http://localhost:4000`)
Use this to test changes before committing or deploying.

**Step 7 – Log in to GitHub Actions (one-time setup)**
- Generate a CI token: `firebase login:ci`
- Add the token as a repository secret named `FIREBASE_TOKEN`. The workflow uses it to deploy automatically on pushes to `live`.

**Step 8 – First deploy from your machine**
```bash
firebase deploy --only hosting,functions
```
The CLI installs client dependencies, builds the Vite bundle, packages the Cloud Function, and uploads both targets. Watch for configuration warnings that usually indicate a missing value in your Cloud Run variables (or, if you're bundling them, `functions/.env`).

**Step 9 – Verify the deployment**
```bash
gcloud run services describe api \
  --region=us-central1 \
  --project=openbid2107 \
  --format="json(spec.template.spec.containers[0].env)"
```
Confirm the output includes the standard environment variables (`FIREBASE_PROJECT_ID`, `STRIPE_SECRET_KEY_FOR_TESTING`, etc.). If a key is missing, update the Cloud Run variables (or your `.env` file), redeploy, and re-check the service output.

### Production Environment Variables
Secret Manager is no longer required. You have two options:

1. **Manage them in Cloud Run (recommended for production):** Open the Cloud Console → Cloud Run → Services → `api` → **Edit & deploy new revision** → **Variables & Secrets**. Add/update the keys listed below. Deployments keep these values automatically.
2. **Use `.env` files for local/emulator runs:** `server/.env` feeds the Node backend when running `npm run dev --prefix server`. `functions/.env` (or `functions/.env.local`) is only needed if you want to run the Functions emulator locally or if you prefer bundling the variables with `firebase deploy`.

For either approach, provide the same values:
- `PROTOTYPE`, `APP_NAME`, `APP_URL`, `EMAIL_VERIFICATION_REDIRECT`
- `DUO_CLIENT_ID`, `DUO_CLIENT_SECRET`, `DUO_API_HOST`, `DUO_REDIRECT_URI`
- `STRIPE_SECRET_KEY_FOR_TESTING`, `STRIPE_SECRET_KEY_FOR_PROD`, `STRIPE_WEBHOOK_SECRET`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY` (or the `APP_FIREBASE_*` aliases)

### Deploy Hosting + Functions
```bash
npm install --prefix functions   # once per machine
npm install --prefix client      # or npm ci for clean installs

firebase deploy --only hosting,functions
```

Verify that the deployed function sees the environment variables:
```bash
gcloud run services describe api \
  --region=us-central1 \
  --project=openbid2107 \
  --format="json(spec.template.spec.containers[0].env)"
```

You should see the standard keys (e.g., `FIREBASE_PROJECT_ID`, `STRIPE_SECRET_KEY_FOR_TESTING`). If something is missing, ensure the variable exists in Cloud Run (or `functions/.env`) and re-run the deploy.

### Local vs. Production Settings
- Keep `server/.env` for local development (`APP_URL=http://localhost:5173`, etc.) and manage production credentials either through Cloud Run variables or (if you prefer bundling) `functions/.env` / `.env.<project>`.
- `client/.env.production` ships with the production values so CI builds target `https://openbid2107.web.app`. Keep personal overrides in `client/.env` / `client/.env.local` when testing against `http://localhost:4000`.

### CI Automation
1. Generate a CI token: `firebase login:ci`.
2. Add the value to GitHub → Repository → Settings → Secrets → Actions → `FIREBASE_TOKEN`.
3. Push or merge into `live`. GitHub Actions will:
   - Install `functions/` deps (which includes the backend via the `file:` dependency),
   - Install and build the client,
   - Deploy Hosting and the Cloud Function.

### Working from the `live` branch

When you create a feature branch off `live`, follow this checklist so local work stays compatible with the serverless pipeline:

1. **Create your feature branch**
   ```bash
   git checkout live
   git pull
   git checkout -b feature/<ticket-or-short-name>
   ```

2. **Set up env files** (first time on a new machine)
   ```bash
   cp server/.env.example server/.env         # fill in shared credentials
   cp client/.env.example client/.env         # local Vite config
   ```
   - `.env.example` files are just templates. The app only reads `.env`/`.env.local`, so be sure to copy and edit your personal versions.
   - Do **not** edit `client/.env.production`; it keeps the production values for CI/Hosting.
   - Use `client/.env` or `client/.env.local` for local overrides (e.g., `VITE_API_BASE=http://localhost:4000`).

3. **Install dependencies**
   ```bash
   npm install --prefix server
   npm install --prefix client
   ```
   If you plan to run or deploy the Cloud Function, also run:
   ```bash
   npm --prefix functions run copy-server
   npm install --prefix functions
   ```

4. **Run everything locally**
   ```bash
   npm run dev --prefix server   # Express API on :4000
   npm run dev --prefix client   # Vite dev server on :5173
   ```
   Optional: `firebase emulators:start --only functions,hosting` to exercise the Hosting → Function rewrite in one process.

5. **Test before pushing**
   - Backend unit/integration tests: `npm test --prefix server`
   - Manual smoke test of signup → Duo → login, map autocomplete, and bid flows.

6. **Commit & push**
   ```bash
   git status   # ensure no .env or secrets are staged
   git commit -am "feat: short summary"
   git push -u origin feature/<ticket-or-short-name>
   ```
   Open a PR into `live`. Merging the PR triggers the GitHub Actions workflow which builds and deploys automatically.

> Keep secrets out of git. Runtime credentials should live in Cloud Run variables or personal `.env` files. The only env file committed to the repo is `client/.env.production` because it contains public-only values.

#### Adding new environment variables
- **Server-side values**: add placeholders to `server/.env.example` and `functions/.env.example`, document them, and ensure `functions/index.js` forwards the variable into `process.env` if the Express app needs it.
- **Client-side (`VITE_*`) values**: update `client/.env` for local dev and ensure `client/.env.production` contains the production-safe value. Never commit private keys.

### Troubleshooting
- **Function crashes at startup**: Ensure every required variable exists in Cloud Run (or, if you deploy from `.env`, that the file is up to date). Missing Firebase admin credentials are the most common cause.
- **Need to rotate credentials**: Update the Cloud Run variables (or your `.env` files) and redeploy so the new values ship with the bundle.
- **Local emulation**: `firebase emulators:start --only functions,hosting` uses the same rewrite rules and reads the same `.env` files (it prefers `.env.local` if present).

With this setup, teammates can:
1. Branch from `live`, run locally (`npm run dev --prefix server` & `npm run dev --prefix client`), and validate against Firestore.
2. Merge back into `live` knowing that GitHub Actions will deploy both the client and API automatically.
