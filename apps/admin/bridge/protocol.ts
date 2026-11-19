export interface NavItem {
  label: string;
  path: string;
}

type HostMessage =
  | { type: "host.probe" }
  | { type: "host.welcome"; instance: string; session: string; path?: string }
  | { type: "host.navigate"; session: string; path: string }
  | { type: "host.assertion.result"; session: string; id: string; assertion: string | null };

type PartnerMessage =
  | { type: "app.hello"; instance: string }
  | { type: "app.navigation"; session: string; items: NavItem[] }
  | { type: "app.route"; session: string; path: string }
  | { type: "app.assertion.request"; session: string; id: string };

const CHANNEL = "workspace.bridge";

export function parseOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new TypeError("Expected an exact HTTP(S) origin.");
  }
  return url.origin;
}

export function isAppPath(value: unknown): value is string {
  if (
    typeof value !== "string" || value.length > 2048 ||
    !value.startsWith("/") || value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) return false;
  const url = new URL(value, "https://path.invalid");
  return url.origin === "https://path.invalid" && !url.pathname.startsWith("//");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isNavItem(value: unknown): value is NavItem {
  return isRecord(value) && typeof value.label === "string" &&
    value.label.trim().length > 0 && value.label.length <= 100 && isAppPath(value.path);
}

export function readPartnerMessage(value: unknown): PartnerMessage | undefined {
  if (!isRecord(value) || value.channel !== CHANNEL || value.version !== 1) return;
  if (value.type === "app.hello" && isIdentifier(value.instance)) {
    return { type: value.type, instance: value.instance };
  }
  const { session } = value;
  if (!isIdentifier(session)) return;
  switch (value.type) {
    case "app.navigation":
      if (Array.isArray(value.items) && value.items.length <= 32 && value.items.every(isNavItem)) {
        return { type: value.type, session, items: value.items };
      }
      break;
    case "app.route":
      if (isAppPath(value.path)) return { type: value.type, session, path: value.path };
      break;
    case "app.assertion.request":
      if (isIdentifier(value.id)) return { type: value.type, session, id: value.id };
  }
}

export function sendHostMessage(peer: Window | null, origin: string, message: HostMessage): void {
  peer?.postMessage({ channel: CHANNEL, version: 1, ...message }, origin);
}
