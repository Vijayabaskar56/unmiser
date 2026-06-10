import { QueryClient } from "@tanstack/react-query";

// Shared query client used by TanStack DB query collections. The collections
// hold this reference directly, so no QueryClientProvider is required.
export const queryClient = new QueryClient();
