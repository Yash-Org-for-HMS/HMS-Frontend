# Frontend Tech Debt

## Data fetching: migrate hand-rolled `useState/useEffect/axios` → react-query

**Status:** in progress — pattern established, migrate incrementally.

Most pages fetch with a hand-rolled `useState` + `useEffect` + `axios` trio.
react-query is already configured (`QueryClientProvider` in `main.tsx`) but only a
handful of pages use it. The hand-rolled pattern has caused two real bugs:

1. **Blank screen on fetch failure** — a `catch` that only `console.error`s leaves
   data `null`, and a `if (!data) return null` renders nothing. (Fixed on
   `Dashboard.tsx`.)
2. **Hidden backend messages** — `catch` blocks showing a hardcoded string instead
   of `err.response?.data?.message`, so staff never see the real reason. (~17 of
   these fixed across billing/pharmacy/reception/rbac/lab/settings.)

### The sanctioned pattern (use this for new + migrated pages)
```tsx
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["resource", ...deps],
  queryFn: async () => (await axiosInstance.get("/path")).data.data,
});

if (isLoading) return <Spinner/>;            // or a Skeleton
if (isError || !data) return (
  <ErrorState
    message={(error as any)?.response?.data?.message}
    onRetry={() => refetch()}
  />
);
```
- `src/components/ErrorState.tsx` — standard retryable error placeholder (mascot
  "oops" + Retry). Drop it in wherever a fetch can fail.
- For mutations, surface `err.response?.data?.message` in the `toast.error(...)`
  fallback so the backend reason shows.

### Reference migration
`src/pages/Dashboard.tsx` — converted to `useQuery` + `ErrorState`. Use it as the
template when migrating the remaining (~60) pages. Do it page-by-page; there's no
need (or safety) in a big-bang rewrite.

### Good moments to migrate a page
- When you're already editing it for a feature/bugfix.
- Prioritize pages with no error UI (blank-screen risk) and high-traffic queues.
