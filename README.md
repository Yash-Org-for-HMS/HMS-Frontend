# HMS — Frontend

React 19 + TypeScript + Vite + Material UI client for the HMS SaaS. Part of the
monorepo (see the [root README](../README.md) for full setup).

## Develop

```bash
# from the repo root (runs frontend + backend together)
npm run dev

# or frontend only, from this folder
npm run dev          # vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build (production bundle)
npm run lint         # eslint
```

## Configuration

| Variable       | Description                                    | Default                      |
|----------------|------------------------------------------------|------------------------------|
| `VITE_API_URL` | Backend API base URL (including `/api`)        | `http://localhost:5000/api`  |

Server-hosted assets (logos, uploaded reports) are resolved via
[`src/utils/assetUrl.ts`](src/utils/assetUrl.ts), which derives the host from
`VITE_API_URL` — so deployments work without hardcoded hosts.

## Structure

```
src/
├── api/axios.ts        # Axios instance: token attach + 401 refresh/redirect
├── contexts/           # Auth (super-admin + hospital), Toast, Confirm
├── layouts/            # Per-portal layouts (admin, reception, doctor, nurse, lab, pharmacy)
├── pages/              # Feature pages grouped by module
├── types/domain.ts     # Shared domain types (adopt incrementally to replace `any`)
└── utils/              # assetUrl and other helpers
```

## Conventions

- **User feedback:** use the `useToast()` hook (not `alert`) and `useConfirm()`
  (not `window.confirm`) for notifications and confirmations.
- **Currency:** display in Indian Rupees (₹).
- **Auth:** the axios instance auto-attaches the right token per route prefix and,
  on a 401, attempts a refresh + retry before redirecting to the correct login.
