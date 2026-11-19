import { useEffect, useState } from "react";
import type { WorkspaceIdentity } from "@/lib/mock-auth/tokens";

export type WorkspaceSession = "loading" | "unavailable" | { origin: string; identity: WorkspaceIdentity };

export function useWorkspaceSession() {
  const [session, setSession] = useState<WorkspaceSession>("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      const response = await fetch("/api/host/session", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Workspace session unavailable.");
      const identity: WorkspaceIdentity = await response.json();
      if (!controller.signal.aborted) setSession({ identity, origin: window.location.origin });
    }
    loadSession().catch(() => {
      if (!controller.signal.aborted) setSession("unavailable");
    });
    return () => controller.abort();
  }, []);

  return session;
}
