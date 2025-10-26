## Client `__tests__`

### `nav.test.jsx`
- Loads the real session store for a contractor or bidder and checks that the Nav breadcrumbs fit the current page.
- Uses `MemoryRouter` so React Router runs the same code as the live app.

### `session.test.js`
- Confirms `setSession` writes data to `localStorage`, notifies listeners, and keeps the mock UID when prototype mode is enabled.
- Checks `setUser` keeps or overrides requirements the right way.
- Uses fake timers to show the inactivity timer fires after two minutes with no activity and then cleans up.

## Run the tests

```bash
cd client
npm run test 
```
