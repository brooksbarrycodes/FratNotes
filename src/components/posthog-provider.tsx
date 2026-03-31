"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Optional PostHog (Open Paper also supports POSTHOG_* on their Python server; this is client-only).
 */
export function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
    });
  }, []);

  return <>{children}</>;
}
