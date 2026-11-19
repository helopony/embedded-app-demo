# Embedded app demo

A workspace loads an independently hosted demand forecasting app in an iframe. The app adds links to the outer sidebar, receives a signed assertion for the current user, and reads sales data through a scoped API. The demo uses synthetic staff and restaurant data.

[Open the demo](https://app-workspace.helopony.com) · [Inspect an embedded authentication request](https://app-workspace.helopony.com/apps/demand-forecast/authentication) · [Compare the standalone result](https://forecast-partner.helopony.com/embed/authentication)

## Try it

The workspace opens its own session and displays the signed-in staff member and restaurant in the outer header, even when the partner is unavailable. Each visitor gets a demo session for Alex Morgan at Berlin Mitte.

1. Open **Authentication** in the workspace sidebar. Inspect the staff, store, installation and app IDs that reached the iframe. Compare the assertion's audience and expiry with the scope and lifetime granted by the token endpoint. Choose **Run authentication again** and compare the new assertion ID (`jti`).
2. Select **Open partner app directly** above the iframe. The new tab loads the same partner page on its own origin. It has no host window to issue the assertion. Its call to the partner forecast endpoint returns HTTP 401 and `launch_assertion_required`.
3. Back in the workspace, switch off **Show Forecast in workspace menu** inside the iframe. The outer menu changes immediately. Restore the link, navigate between forecast and overview, then use Back or reload the deep link.
4. In the **Bridge inspector**, choose **Events** to see the browser message sequence or **Manifest** to inspect the installed app definition.

## Source layout

This npm monorepo contains two Next.js apps. Each has its own `app/` route tree, server code and browser bridge. The only shared application package is the UI component library.

| Workspace | Owns | Source |
|---|---|---|
| `apps/admin` | Outer header and sidebar, iframe, installed app record, staff sessions, token issuance and sales API | [Admin shell](apps/admin/components/admin-shell.tsx) · [Host bridge](apps/admin/bridge/index.ts) · [API routes](apps/admin/app/api) |
| `apps/partner` | Embedded pages, menu declaration, assertion requests and forecast backend | [Partner app](apps/partner/components/partner-app.tsx) · [Partner bridge](apps/partner/bridge/index.ts) · [HTTP client](apps/partner/lib/forecast-client.ts) |
| `packages/ui` | Presentational components used by both apps | [UI package](packages/ui) |

The partner declares its ID, name, origin, home route, bridge version and requested scopes in its manifest. Installation is mocked by keeping an approved copy in the admin's registry. Changing the partner file has no effect on the installed record until that record is updated. [Partner manifest](apps/partner/app.manifest.json) · [Admin installation record](apps/admin/lib/installed-app.json)

For example, the admin route `/apps/demand-forecast/authentication` opens the partner route `/embed/authentication` on the partner origin. Inside the iframe, a `MutationObserver` watches the hidden `<workspace-app-nav>` element. After the handshake and on changes, the partner reads its direct links and sends their labels and paths in an `app.navigation` message. The admin validates the message and renders the links in its own sidebar. Clicking one updates the outer URL and sends `host.navigate` to the existing iframe. An in-app navigation travels back as `app.route`. [Navigation declaration reader](apps/partner/bridge/navigation.ts) · [Bridge interoperability tests](tests/bridge.test.mjs)

## Authentication

1. **Connect the two browser windows.** The iframe and its parent exchange versioned `postMessage` messages. They check the exact origin and source window, then use a bridge session ID to route messages for this connection.
2. **Identify the current staff session.** The workspace creates or resumes a session with a first-party `POST /api/host/session` and displays the returned staff and store names. When the frame calls `getAssertion()`, the host sends `POST /api/host/launch`. The endpoint uses the workspace’s HttpOnly demo-session cookie to sign an HS256 launch JWT with a 60-second lifetime. The host sends that JWT to the requesting iframe over the bridge. Its claims identify the issuer (`iss`), staff (`sub`), receiving app (`aud`), store, installation, session, issue and expiry times, and unique assertion ID. The iframe can decode claims for display. The authorization server verifies the signature and claims before issuing access.
3. **Authenticate the partner server.** The iframe sends the launch assertion to its own `GET /api/partner/forecast` as a bearer credential. The partner backend submits it as the OAuth `subject_token` in a form-encoded token exchange at `POST /api/oauth/token`. The backend supplies the manifest ID as its registered client ID and a server-side client secret with HTTP Basic authentication and requests `sales.summary.read`. The authorization server checks the client credentials, assertion audience, expiry and demo grant. The secret lives in server configuration.
4. **Authorize the data read.** The exchange returns a 120-second access token with the granted scope. The partner backend presents it to `GET /api/sales`. The sales API verifies the token's API audience, client and scope before releasing the staff and restaurant display names and forecast rows. The partner returns those fields and selected metadata from the two HTTP responses. The **Authentication** page displays the exchange status, granted scope, lifetime and sales response status from that read. The complete access token stays on the server.

Client registration, installation and consent are preconfigured. The backend makes real HTTP requests and validates signed tokens against that fixed grant. A stateless launch assertion can be exchanged again until expiry. The inspector displays selected fields and omits usable credentials.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

The root command starts two dev servers. Open the admin at **http://localhost:3000** to try the full flow. Open the partner at **http://127.0.0.1:3001** for the standalone authentication check. Development uses local-only placeholder credentials.

To run one app from the repository root, use its workspace path. The full embedded flow needs both servers running.

| Operation | Admin | Partner |
|---|---|---|
| Start dev server | `npm run dev --workspace ./apps/admin` | `npm run dev --workspace ./apps/partner` |
| Build | `npm run build --workspace ./apps/admin` | `npm run build --workspace ./apps/partner` |

Run checks and build both apps from the root.

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

For an installed desktop Chrome, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Set `DEMO_BASE_URL` to run the same browser checks against a deployed host.

## Hosting

Use two Vercel projects linked to this repository, each with the Next.js preset. Set the Root Directory to `apps/admin` on the workspace project and `apps/partner` on the partner project. Enable **Include source files outside of the Root Directory in the Build Step** on both so each build can import `packages/ui`. [Vercel monorepo settings](https://vercel.com/docs/monorepos/monorepo-faq)

| Server setting | Admin project | Partner project |
|---|---|---|
| Domain | [Workspace](https://app-workspace.helopony.com) | [Standalone partner](https://forecast-partner.helopony.com) |
| `WORKSPACE_HOST_ORIGIN` | `https://app-workspace.helopony.com` | Same value, used for server-to-server requests and allowed embedding |
| `WORKSPACE_PARTNER_ORIGIN` | `https://forecast-partner.helopony.com` | Same value, used as the partner origin |
| `WORKSPACE_EXTRA_HOST_ORIGINS` | Optional comma-separated list of approved host origins | Same allowlist |
| `DEMO_SIGNING_SECRET` | Signs and verifies the admin session, launch assertion and access token | — |
| `DEMO_CLIENT_SECRET` | Verifies the partner's HTTP Basic credential | Authenticates the partner to the admin's token endpoint |

Generate two independent secrets of at least 32 bytes each. Configure the client secret on both servers and the signing secret only on the admin. The browser receives the short-lived launch assertion. The access token and client secret stay on the servers.
