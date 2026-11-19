# SIDES partner app prototype

A small, independent demonstration of a Shopify-style partner app inside a restaurant admin. The admin and the partner load on different browser origins. Both use React and shadcn/ui. The data and staff identity are synthetic.

[Open the demo](https://sides-app-chi.vercel.app)

## Try it

1. Open **Demand Forecast**. The SIDES sidebar receives **Overview** and **Forecast** from the embedded partner app.
2. Switch off **Show Forecast in SIDES menu** inside the iframe. The host menu changes immediately. Switch it back on and use the restored link.
3. Navigate inside the partner app, then use the browser Back button or reload a deep link. Both pages stay on the same logical route.
4. Choose **Refresh** for another authenticated read. The **Bridge inspector** shows the message sequence and the installed manifest.

## Source layout

| Part | Location | Responsibility |
|---|---|---|
| Host UI | `apps/admin` | Owns the outer sidebar and URL, creates the iframe, obtains launch assertions, displays the inspector. |
| Partner test app | `apps/test-app` | Declares navigation with `<sides-app-nav>`, displays the forecast, requests identity via the bridge. |
| Bridge library | `packages/bridge` | Implements the typed, versioned handshake, origin/window checks, navigation updates, request timeouts and cleanup. |
| Mock backend | `app/api`, `lib/mock-auth` | Supplies a signed demo session, token exchange and the protected sales endpoint. |
| Manifest v1 | [sides.app.json](apps/test-app/sides.app.json) | Registers the app ID, name, partner origin, logical home path, bridge version and granted scope. |

The example has one preinstalled app. Its ID doubles as its OAuth client ID. Menu labels and routes come from the partner DOM at runtime. The bridge watches direct `<a>` children of a hidden `<sides-app-nav>` element and relays allowed app-relative routes to the admin. Locally, the active manifest uses the loopback partner origin.

## Authentication

1. The partner frame and the SIDES parent establish a versioned session with exact origin and source-window checks.
2. The iframe requests an assertion. The parent calls its first-party `POST /api/host/launch`, which uses an HttpOnly demo-session cookie and returns a signed, 60-second launch assertion bound to the client, staff member, store and installation.
3. The partner frontend sends that assertion to its own `GET /api/partner/forecast`. The partner backend authenticates its client with a server-only secret and exchanges the assertion at the host's `POST /api/oauth/token`.
4. The host returns a 120-second API access token. The partner backend uses it to call `GET /api/sales` under the `sales.summary.read` scope. Only the forecast data returns to the iframe.

The grant always represents Alex Morgan at Berlin Mitte. Visitors share the same synthetic identity. The demo uses no third-party cookies, live restaurant data, persistent consent records, or production identity provider. The stateless launch assertion can be exchanged again until expiry. Tokens and secrets are omitted from the inspector.

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

## Vercel

One Vercel project serves one committed build across two independent HTTPS origins. Host pages and host-only API routes enforce the host origin allowlist. The partner UI and its backend require the partner origin.

| Server setting | Value or purpose |
|---|---|
| `SIDES_HOST_ORIGIN` | Canonical public host origin used for server-to-server OAuth and data requests. |
| `SIDES_EXTRA_HOST_ORIGINS` | Comma-separated exact admin aliases, including an approved custom hostname. |
| `SIDES_PARTNER_ORIGIN` | Exact partner origin. It must differ from every allowed host origin. |
| `DEMO_SIGNING_SECRET`, `DEMO_CLIENT_SECRET` | Two independently generated server-only secrets of at least 32 bytes each. |

The live project uses `sides-app-chi.vercel.app` for the admin and `sides-partner-helopony.vercel.app` for the partner iframe. Assign both names to the same deployment and set the environment variables before building. DNS for the optional `sides-app.helopony.com` host is managed in helopony-platform.
