"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Sem baseURL: usa a própria origem do web, e o rewrite de /api/* leva à api.
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { useSession } = authClient;
