import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/providers/ToastContext";

/**
 * Render a component inside the providers it expects, with a query client that
 * behaves in a test: no retries (a failing request should fail the test, not be
 * silently retried) and no cache shared between tests.
 */
export function renderWithProviders(ui: ReactElement, { wrapper }: { wrapper?: (c: ReactNode) => ReactNode } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const inner = (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

  return { queryClient, ...render(wrapper ? <>{wrapper(inner)}</> : inner) };
}
