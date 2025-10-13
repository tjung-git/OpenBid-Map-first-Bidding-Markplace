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

## Project Structure
```
.
├── .github/              # Github configuration files
│   ├── pull_request_template.md     # Request template for creating pull requests
├── .vscode/              # VSCode configuration files
│   ├── settings.json    # VSCode latex settings
├── documentation/        # LaTeX documents for 1.1 and 1.2
│   ├── 1.1 Project Proposal/     # LaTeX documents for 1.1
│   │   ├── main.pdf         # Compiled 1.1 PDF output
│   │   └── main.tex         # Main 1.1 LaTeX document
│   ├── 1.2 Detailed User Stories, Requirements, and Initial Prototype/     # LaTeX documents for 1.2
│   │   ├── main.pdf         # Compiled 1.2 PDF output
│   │   ├── main.tex         # Main 1.2 LaTeX document
│   │   ├── UC-1.png        # Manage Jobs UML diagram
│   │   ├── UC-2.png        # Browse & Bid UML diagram
│   │   ├── UC-3.png        # Award & Escrow UML diagram
│   │   └── UC-4.png        # Complete & Payout UML diagram
├── .gitignore           # git ignore
├── Makefile             # Automation scripts
└── README.md           # This file
```

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
   APP_URL=http://localhost:5176
   EMAIL_VERIFICATION_REDIRECT=http://localhost:5176/login
   APP_NAME=OpenBid
   ```

   - `APP_URL` / `EMAIL_VERIFICATION_REDIRECT` should reference the client dev server; add the host to Firebase Auth’s authorized domains list.
   - Leave other keys as-is unless you change ports.

### 3. React client environment

Create or edit `client/.env`:

```ini
VITE_PROTOTYPE=FALSE
VITE_API_BASE=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=<optional>
```

The API key from step 2 is consumed on the server; the client only needs its backend URL (and optionally a Google Maps key).

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
- Visit `http://localhost:5176/` to access the login page.
