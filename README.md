# Embedded app demo

A workspace loads an independently hosted demand forecasting app in an iframe. The app adds links to the outer sidebar, receives a signed assertion for the current user, and reads sales data through a scoped API. The demo uses synthetic staff and restaurant data.

[Open the demo](https://app-workspace.helopony.com) · [Inspect a live authentication request](https://app-workspace.helopony.com/apps/demand-forecast/authentication)

## Try it

The workspace opens its own session and displays the signed-in staff member and restaurant in the outer header, even when the partner is unavailable. Each visitor gets a demo session for Alex Morgan at Berlin Mitte.

1. Open **Authentication** in the workspace sidebar. Inspect the staff, store, installation and app IDs that reached the iframe. Compare the assertion's audience and expiry with the scope and lifetime granted by the token endpoint. Refresh to run the exchange again and compare the new assertion ID (`jti`).
2. Select **Open partner app directly** above the iframe. The new tab loads the same partner page on its own origin. It has no host window to issue the assertion. Its call to the partner forecast endpoint returns HTTP 401 and `launch_assertion_required`.
3. Back in the workspace, switch off **Show Forecast in workspace menu** inside the iframe. The outer menu changes immediately. Restore the link, navigate between forecast and overview, then use Back or reload the deep link.
4. In the **Bridge inspector**, choose **Events** to see the browser message sequence or **Manifest** to inspect the installed app definition.

## Source layout

| Part | Location | Responsibility |
|---|---|---|
| Host UI | [admin-shell.tsx](apps/admin/admin-shell.tsx) | Connects the iframe to the host bridge, synchronizes the outer URL, and supplies launch assertions. |
| Partner test app | [partner-app.tsx](apps/test-app/partner-app.tsx) | Publishes its menu through `<workspace-app-nav>` and requests a launch assertion before fetching the forecast. |
| Bridge library | `packages/bridge` | Implements the typed, versioned handshake, origin/window checks, navigation updates, request timeouts and cleanup. |
| Mock backend | `app/api`, `lib/mock-auth` | Supplies a signed demo session, token exchange and the protected sales endpoint. |
| Manifest v1 | [app.manifest.json](apps/test-app/app.manifest.json) | Registers the app ID, name, partner origin, logical home path, bridge version and granted scope. |

The example has one preinstalled app. Its ID doubles as its OAuth client ID. The manifest identifies the origin the workspace may frame, its home route, bridge version and requested permissions. On the partner side a `MutationObserver` watches a hidden `<workspace-app-nav>` element. After the handshake and whenever that element changes, the bridge reads its direct links and sends an `app.navigation` message containing labels and app-relative paths. The workspace renders those links in its own document. Selecting one updates the outer URL and sends `host.navigate` to the existing iframe. A route change initiated by the app travels back as `app.route`.

## Authentication

1. **Connect the two browser windows.** The iframe and its parent exchange versioned `postMessage` messages. They check the exact origin and source window, then use a bridge session ID to route messages for this connection.
2. **Identify the current staff session.** The workspace creates or resumes a session with a first-party `POST /api/host/session` and displays the returned staff and store names. When the frame calls `getAssertion()`, the host sends `POST /api/host/launch`. The endpoint uses the workspace’s HttpOnly demo-session cookie to sign an HS256 launch JWT with a 60-second lifetime. The host sends that JWT to the requesting iframe over the bridge. Its claims identify the issuer (`iss`), staff (`sub`), receiving app (`aud`), store, installation, session, issue and expiry times, and unique assertion ID. The iframe can decode claims for display. The authorization server verifies the signature and claims before issuing access.
3. **Authenticate the partner server.** The iframe sends the launch assertion to its own `GET /api/partner/forecast` as a bearer credential. The partner backend submits it as the OAuth `subject_token` in a form-encoded token exchange at `POST /api/oauth/token`. The backend supplies its registered client ID and secret with HTTP Basic authentication and requests `sales.summary.read`. The authorization server checks the client credentials, assertion audience, expiry and demo grant. The secret lives in server configuration.
4. **Authorize the data read.** The exchange returns a 120-second access token with the granted scope. The partner backend presents it to `GET /api/sales`. The sales API verifies the token's API audience, client and scope before releasing the staff and restaurant display names and forecast rows. The partner returns those fields and selected metadata from the two HTTP responses. The **Authentication** page displays the exchange status, granted scope, lifetime and sales response status from that read. The complete access token stays on the server.

Client registration, installation and consent are preconfigured. The backend makes real HTTP requests and validates signed tokens against that fixed grant. A stateless launch assertion can be exchanged again until expiry. The inspector displays selected fields and omits usable credentials.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. The embedded app runs at **http://127.0.0.1:3000**. A single Next.js process serves both origins. Open the localhost address as the admin so message checks and the first-party cookie match. The partner page opened directly displays the required host context. Development uses local-only placeholder credentials.

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

For an installed desktop Chrome, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Set `DEMO_BASE_URL` to run the same browser checks against a deployed host.

## Hosting

The workspace and partner run as independent Vercel projects, with separate deployments and server environments. The workspace serves its admin UI, first-party session endpoint, authorization server and sales API. The partner serves its iframe UI and forecast backend. Its server makes HTTPS requests back to the workspace to exchange the assertion and fetch sales. [Workspace](https://app-workspace.helopony.com) · [Standalone partner app](https://forecast-partner-helopony.vercel.app)

| Server setting | Workspace project | Partner project |
|---|---|---|
| `WORKSPACE_DEPLOYMENT_ROLE` | `host` | `partner` |
| `WORKSPACE_HOST_ORIGIN` | `https://app-workspace.helopony.com` | Same value |
| `WORKSPACE_PARTNER_ORIGIN` | `https://forecast-partner-helopony.vercel.app` | Same value |
| `WORKSPACE_EXTRA_HOST_ORIGINS` | Optional comma-separated list of approved host origins | Same allowlist |
| `DEMO_SIGNING_SECRET` | Signs and verifies the demo credentials | Omit |
| `DEMO_CLIENT_SECRET` | Verifies the client credential during exchange | Authenticates the partner during exchange |

Use independent, randomly generated values of at least 32 bytes for the two secrets. Configure the same client secret on the two servers. For local development, leave the deployment role unset and use the two loopback origins described above.
