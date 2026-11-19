import { isAppPath, parseOrigin, readPartnerMessage, sendMessage, type NavItem } from "./protocol.js";

export type { NavItem } from "./protocol.js";

export interface HostBridgeOptions {
  frame: HTMLIFrameElement;
  appOrigin: string;
  onNavigation: (items: NavItem[]) => void;
  onRoute: (path: string) => void;
  onReady: () => void;
  getAssertion: () => Promise<string>;
  onEvent?: (label: string) => void;
}

export function createHostBridge(options: HostBridgeOptions) {
  const { frame, onEvent } = options;
  const hostWindow = window;
  const origin = parseOrigin(options.appOrigin);
  let instance: string | undefined;
  let session: string | undefined;
  let lastPath: string | undefined;
  let destroyed = false;

  const probe = () => sendMessage(frame.contentWindow, origin, { type: "host.probe" });

  async function answer(id: string, requestedSession: string) {
    onEvent?.("App requested a launch assertion");
    let assertion: string | null = null;
    try {
      assertion = await options.getAssertion();
    } catch {
      // The app receives a generic failure. Server errors may contain private details.
    }
    if (destroyed || session !== requestedSession) return;
    sendMessage(frame.contentWindow, origin, { type: "host.assertion.result", session, id, assertion });
    onEvent?.(assertion ? "Host returned a launch assertion" : "Host declined the assertion");
  }

  function receive(event: MessageEvent) {
    if (event.origin !== origin || !frame.contentWindow || event.source !== frame.contentWindow) return;
    const message = readPartnerMessage(event.data);
    if (!message) return;
    if (message.type === "app.hello") {
      const first = instance !== message.instance;
      if (first) {
        instance = message.instance;
        session = crypto.randomUUID();
      }
      if (!session) return;
      sendMessage(frame.contentWindow, origin, {
        type: "host.welcome", instance: message.instance, session, path: lastPath,
      });
      if (first) {
        options.onReady();
        onEvent?.("Partner connected");
      }
      return;
    }
    if (!session || message.session !== session) return;
    switch (message.type) {
      case "app.navigation":
        options.onNavigation(message.items);
        onEvent?.("Partner published navigation");
        break;
      case "app.route":
        if (message.path !== lastPath) {
          lastPath = message.path;
          options.onRoute(message.path);
        }
        break;
      case "app.assertion.request":
        void answer(message.id, session);
        break;
    }
  }

  hostWindow.addEventListener("message", receive);
  frame.addEventListener("load", probe);
  probe();

  return {
    navigate(path: string) {
      if (!isAppPath(path)) throw new TypeError("Expected an app-relative route.");
      if (destroyed || path === lastPath) return;
      lastPath = path;
      if (session) sendMessage(frame.contentWindow, origin, { type: "host.navigate", session, path });
    },
    destroy() {
      destroyed = true;
      hostWindow.removeEventListener("message", receive);
      frame.removeEventListener("load", probe);
    },
  };
}
