## Real Adapter Integration Suites
These Jest suites exercise the Express routes with the production adapters for Firestore Database. The helper `createRealApp` in `testUtils.js` wires the real auth/db adapters, so each spec validates the behaviour we expect once the backend is pointed at Firebase services.

### Auth (`auth.integration.real.routes.test.js`)
- Signup provisions Jane Doe and triggers the Firebase verification flow.
- Input validation: rejects invalid email formats, passwords shorter than eight characters, and missing first/last names.
- Password confirmation: signup fails fast when `confirmPassword` is missing or does not match `password`.
- Login lifecycle: verified users get sessions, wrong passwords bubble the Firebase `INVALID_PASSWORD` error, duplicate signup is blocked.
- Role switching requires authentication, `/me` returns the sanitized profile only with a valid session header.
- Email verification endpoint covers success, unknown user, and missing email payload scenarios.

### Jobs (`jobs.integration.real.routes.test.js`)
- Verified contractors can create jobs; bidders and KYC-pending contractors are rejected.
- Only job owners with open jobs may patch or delete them; status changes to non-open return `job_locked`.
- Cross-account access (patch/delete by another contractor) is forbidden.

### Bids (`bids.integration.real.routes.test.js`)
- Contractors cannot bid on their own jobs.
- Accepting a bid flips the job to `awarded`, hides it from uninvolved users, and locks further edits to both the job and the accepted bid.

## Running the suites

From the `server/` directory run:

```bash
npm run test
```
