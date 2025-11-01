# OpenBid: Map-first Bidding Marketplace

## Project Overview
OpenBid is a map-first bidding marketplace platform developed by Team 1: Tyler, Mani, Yanness, Alaister.

## Prerequisites

### Required Software Installation

#### 1. LaTeX Distribution
To compile the project proposal documents, you need a LaTeX distribution installed:

**macOS (Recommended - Homebrew):**
```bash
# Install Homebrew if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MacTeX using Homebrew:
brew install --cask mactex

# Add LaTeX to your PATH (add to ~/.zshrc or ~/.bash_profile):
echo 'export PATH="/Library/TeX/texbin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**macOS (Alternative Methods):**
- Download [MacTeX.pkg](https://www.tug.org/mactex/) directly and install via GUI
- For minimal installation: `brew install --cask basictex` (then install additional packages as needed)

**Windows:**
- Install [MiKTeX](https://miktex.org/download) (recommended for Windows)
- Or install [TeX Live](https://www.tug.org/texlive/windows.html)

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install texlive-full
```

#### 2. Make Utility
The project uses a Makefile for automation.

**macOS:**
- Make is pre-installed on macOS. Verify with:
  ```bash
  make --version
  ```
- If you need a newer version, install via Homebrew:
  ```bash
  brew install make
  ```

**Windows:**
- Install via Chocolatey: `choco install make`
- Or use WSL: Install Windows Subsystem for Linux

**Linux:**
- Typically pre-installed. If not: `sudo apt-get install make`

#### 3. latexmk (Recommended)
latexmk automates LaTeX document compilation.

**macOS:**
- Included with MacTeX installation via Homebrew
- Verify: `latexmk --version`
- If missing: `sudo tlmgr install latexmk`

## Usage

### Building the Project Proposal
```bash
# Clean LaTeX compilation artifacts
make clean-latex

# Show available commands
make help
```

### Manual Compilation
```bash
#Both code blocks should only be run from the repo root directory

#Create Project Proposal 1.1 as a PDF file
cd "documentation/1.1 Project Proposal" 
pdflatex main.tex

#Create Project Proposal 1.2 as a PDF file
cd "documentation/1.2 Detailed User Stories, Requirements, and Initial Prototype" 
pdflatex main.tex
```

## Application Setup

These steps provision Firebase, configure the Node/React apps, and run the prototype.

### 1. Firebase project, auth, and database

1. Sign in at [https://console.firebase.google.com](https://console.firebase.google.com) with a Google account.
2. From **Project Overview** click **Add app** → **Web**. Give it any nickname (no hosting required).
3. Open **Build → Authentication → Sign-in method** and enable **Email/Password**.
4. Open **Build → Firestore Database** and create a database in **Native mode**. Choose *Standard* rules (Enterprise requires a paid plan). Replace the default rules with:

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

   Collections such as `users`, `jobs`, and `bids` are created automatically by the backend when you exercise the routes.

### 2. Populate `server/.env`

1. Navigate to **Project settings → Service accounts** and click **Generate new private key**. Copy the `project_id`, `client_email`, and `private_key` values.
2. In **Project settings → General**, locate the web app you added earlier and copy the `apiKey` from the config snippet.
3. Update `server/.env` with your values (keep the private key newlines escaped as shown):

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

   - `APP_URL` / `EMAIL_VERIFICATION_REDIRECT` should reference the client dev server; add the host to Firebase Auth’s authorized domains list.
   - Leave other keys as-is unless you change ports.

### 3. React client environment

Create or edit `client/.env` for local development:

```ini
VITE_PROTOTYPE=FALSE
VITE_API_BASE=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=<optional>
```

The repo also includes `client/.env.production` so CI builds and Firebase Hosting deploys always inject the serverless API origin and public Maps key. Vite reads `*.production` when `NODE_ENV=production`; without it the bundle falls back to `http://localhost:4000`, which caused the hosted app to post to a non-existent local server after login. Keep this file checked in and use `client/.env`/`client/.env.local` for local overrides.

### 4. Email Verification Workflow

- The server signs users up via Firebase Identity Toolkit. Firebase sends the verification email automatically.
- During testing you can use a disposable inbox such as [temp-mail.org](https://temp-mail.org/en/) to receive the link.
- Login is blocked until the email is verified. After clicking the link, log in again—our backend syncs Firestore with Firebase Auth.
- **Temporary note:** KYC is not yet automated. After verifying email, set the new user’s `kycStatus` to `verified` manually in Firestore to simulate a passed KYC check. A Duo-based 2FA implementation will replace this step in a future iteration.

### 5. Install & Run

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

- With `PROTOTYPE=TRUE` the backend falls back to in-memory mocks (no Firebase, no email). Keep it `FALSE` for the real stack.
- Visit `http://localhost:5173/` to access the login page.

---

## Serverless Deployment (Firebase Hosting + Cloud Functions)

This section layers the production-ready serverless workflow on top of the existing prototype instructions.

### Architecture Overview
- **Frontend** (Vite) is built to `client/dist` and deployed to Firebase Hosting (`openbid2107`). `firebase.json` rewrites `/api/**` to the backend function and serves the SPA for every other route.
- **Backend API** reuses the existing Express app. `server/src/app.serverless.js` exports the app without calling `app.listen()`.
- **Cloud Function** (`functions/index.js`) pulls secrets at runtime, injects them into `process.env`, lazy-loads the Express app, and handles each HTTPS request.
- **CI/CD**: `.github/workflows/deploy-live.yml` builds the client, installs Cloud Function deps, and deploys Hosting + Functions whenever the `live` branch updates (requires a `FIREBASE_TOKEN` repo secret).

### Repository Additions
- `server/src/app.serverless.js` – serverless-compatible Express factory.
- `firebase.json` / `.firebaserc` – Hosting + Functions config with rewrite rules.
- `functions/index.js` – HTTPS function that loads secrets via `defineSecret` and returns the Express app’s response.
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

> ✅ The repository already includes `firebase.json`, `.firebaserc`, `server/src/app.serverless.js`, and `functions/index.js`. These files are hand-written (not auto-generated) and should stay exactly as committed. Running `firebase init` on top of them with “do not overwrite” ensures the CLI registers the project without clobbering our custom code.

**Step 4 – Install dependencies locally**
```bash
npm install --prefix server
npm install --prefix client
npm --prefix functions run copy-server
npm install --prefix functions
```
The `copy-server` script duplicates the `server/` source into `functions/server/` (excluding `node_modules`). This lets Firebase bundle the Express code as a local dependency when it runs `npm install` in the deployment build.
The `functions` install pulls in `openbid-server` via the local `file:../server` package so the deployed function can import the Express app.

**Step 5 – Configure secrets in Firebase**
Follow the commands in the next section (“Production Environment & Secrets”). They store values in Secret Manager and the function loads them at runtime. Remember to paste the full private key exactly as it appears in `server/.env` (with the line breaks intact).

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
The CLI installs client dependencies, builds the Vite bundle, packages the Cloud Function, and uploads both targets. Watch for any missing-secret errors during this step.

**Step 9 – Verify the deployment**
```bash
gcloud run services describe api \
  --region=us-central1 \
  --project=openbid2107 \
  --format="json(spec.template.spec.containers[0].env)"
```
Confirm the output includes the standard environment variables (`FIREBASE_PROJECT_ID`, `STRIPE_SECRET_KEY_FOR_TESTING`, etc.). If a key is missing, re-run the corresponding `firebase functions:secrets:set` command and deploy again.

### Production Environment & Secrets
All sensitive values live in Firebase Secret Manager. Some key names (`FIREBASE_*`) are reserved for internal use, so we store them with an `APP_` prefix and let the Cloud Function map them back at runtime.

Run the following once (replace placeholders with your real values):

```bash
# Core flags / URLs
printf 'FALSE' | firebase functions:secrets:set PROTOTYPE --data-file=-
printf 'OpenBid' | firebase functions:secrets:set APP_NAME --data-file=-
printf 'https://openbid2107.web.app' | firebase functions:secrets:set APP_URL --data-file=-
printf 'https://openbid2107.web.app/login' | firebase functions:secrets:set EMAIL_VERIFICATION_REDIRECT --data-file=-

# Duo 2FA
printf '<YOUR_DUO_CLIENT_ID>' | firebase functions:secrets:set DUO_CLIENT_ID --data-file=-
printf '<YOUR_DUO_CLIENT_SECRET>' | firebase functions:secrets:set DUO_CLIENT_SECRET --data-file=-
printf '<YOUR_DUO_API_HOST>' | firebase functions:secrets:set DUO_API_HOST --data-file=-
printf 'https://openbid2107.web.app/api/auth/duo/callback' | firebase functions:secrets:set DUO_REDIRECT_URI --data-file=-

# Stripe
printf '<YOUR_STRIPE_TEST_SECRET>' | firebase functions:secrets:set STRIPE_SECRET_KEY_FOR_TESTING --data-file=-
printf '<YOUR_STRIPE_PROD_SECRET>' | firebase functions:secrets:set STRIPE_SECRET_KEY_FOR_PROD --data-file=-
printf '<YOUR_STRIPE_WEBHOOK_SECRET>' | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file=-

# Firebase admin bundle (prefixed to avoid reserved names)
printf '<YOUR_FIREBASE_PROJECT_ID>' | firebase functions:secrets:set APP_FIREBASE_PROJECT_ID --data-file=-
printf '<YOUR_FIREBASE_CLIENT_EMAIL>' | firebase functions:secrets:set APP_FIREBASE_CLIENT_EMAIL --data-file=-
cat <<'EOF' | firebase functions:secrets:set APP_FIREBASE_PRIVATE_KEY --data-file=-
-----BEGIN PRIVATE KEY-----
...your key...
-----END PRIVATE KEY-----
EOF
printf '<YOUR_FIREBASE_WEB_API_KEY>' | firebase functions:secrets:set APP_FIREBASE_WEB_API_KEY --data-file=-
```

`functions/index.js` calls `defineSecret(...)` for each entry, writes the values into the expected environment variables (including the `FIREBASE_*` keys), and then imports the Express app. No manual Cloud Run configuration is required.

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

You should see the standard keys (e.g., `FIREBASE_PROJECT_ID`, `STRIPE_SECRET_KEY_FOR_TESTING`) even though their secrets are stored with the `APP_*` prefix.

### Local vs. Production Settings
- Keep `server/.env` for local development (`APP_URL=http://localhost:5173`, etc.). For production overrides, rely on Firebase Secret Manager.
- `client/.env.production` ships with the production values so CI builds target `https://openbid2107.web.app`. Keep personal overrides in `client/.env` / `client/.env.local` when testing against `http://localhost:4000`.

### CI Automation
1. Generate a CI token: `firebase login:ci`.
2. Add the value to GitHub → Repository → Settings → Secrets → Actions → `FIREBASE_TOKEN`.
3. Push or merge into `live`. GitHub Actions will:
   - Install `functions/` deps (which includes the backend via the `file:` dependency),
   - Install and build the client,
   - Deploy Hosting and the Cloud Function.

### Troubleshooting
- **Function crashes at startup**: Ensure all secrets above are set; missing Firebase admin credentials are the most common cause.
- **Need to rotate secrets**: Re-run the `firebase functions:secrets:set` command. Deploying the function pulls the latest version automatically.
- **Local emulation**: `firebase emulators:start --only functions,hosting` uses the same rewrite rules and will load secrets if you export them to `.env.local`.

With this setup, teammates can:
1. Branch from `live`, run locally (`npm run dev --prefix server` & `npm run dev --prefix client`), and validate against Firestore.
2. Merge back into `live` knowing that GitHub Actions will deploy both the client and API automatically.
