import { useEffect, useState } from "react";

export type Route =
  | { page: "index" }
  | { page: "new"; parentId?: string }
  | { page: "show"; id: string }
  | { page: "logs"; id: string }
  | { page: "agents" }
  | { page: "agent"; id: string | "new" }
  | { page: "environments" }
  | { page: "environment"; id: string | "new" }
  | { page: "vaults" }
  | { page: "vault"; id: string | "new" };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, "");
  let m: RegExpExecArray | null;
  if ((m = /^\/c\/([0-9a-f-]{36})\/logs$/.exec(h))) return { page: "logs", id: m[1]! };
  if ((m = /^\/c\/([0-9a-f-]{36})$/.exec(h))) return { page: "show", id: m[1]! };
  if ((m = /^\/new(?:\?parent=([0-9a-f-]{36}))?$/.exec(h))) return { page: "new", parentId: m[1] };
  if (h === "/agents") return { page: "agents" };
  if ((m = /^\/agents\/(new|[0-9a-f-]{36})$/.exec(h))) return { page: "agent", id: m[1]! };
  if (h === "/environments") return { page: "environments" };
  if ((m = /^\/environments\/(new|[0-9a-f-]{36})$/.exec(h))) return { page: "environment", id: m[1]! };
  if (h === "/vaults") return { page: "vaults" };
  if ((m = /^\/vaults\/(new|[0-9a-f-]{36})$/.exec(h))) return { page: "vault", id: m[1]! };
  return { page: "index" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export const paths = {
  index: "#/",
  new: (parentId?: string) => (parentId ? `#/new?parent=${parentId}` : "#/new"),
  show: (id: string) => `#/c/${id}`,
  logs: (id: string) => `#/c/${id}/logs`,
  agents: "#/agents",
  agent: (id: string) => `#/agents/${id}`,
  environments: "#/environments",
  environment: (id: string) => `#/environments/${id}`,
  vaults: "#/vaults",
  vault: (id: string) => `#/vaults/${id}`,
};
