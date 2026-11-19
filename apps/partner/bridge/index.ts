import { isAppPath, parseOrigin, readHostMessage, sendPartnerMessage } from "./protocol.ts";
import { readNavigation, watchNavigation } from "./navigation.ts";

export interface AppBridgeOptions {
  hostOrigin: string;
  onNavigate: (path: string) => void;
  onEvent?: (label: string) => void;
}

interface PendingAssertion {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createAppBridge(options: AppBridgeOptions) {
  const origin = parseOrigin(options.hostOrigin);
  const appWindow = window;
  const parent = appWindow.parent;
  const instance = crypto.randomUUID();
  const pending = new Map<string, PendingAssertion>();
  let session: string | undefined;
  let lastPath: string | undefined;
  let destroyed = false;

  function hello() {
    if (parent !== appWindow) sendPartnerMessage(parent, origin, { type: "app.hello", instance });
  }
  function publishNavigation() {
    if (session) sendPartnerMessage(parent, origin, { type: "app.navigation", session, items: readNavigation() });
  }
  function request(id: string) {
    if (session) sendPartnerMessage(parent, origin, { type: "app.assertion.request", session, id });
  }

  function receive(event: MessageEvent) {
    if (parent === appWindow || event.origin !== origin || event.source !== parent) return;
    const message = readHostMessage(event.data);
    if (!message) return;
    if (message.type === "host.probe") {
      hello();
      return;
    }
    if (message.type === "host.welcome") {
      if (message.instance !== instance || message.session === session) return;
      session = message.session;
      options.onEvent?.("Connected to workspace");
      publishNavigation();
      if (message.path && message.path !== lastPath) {
        lastPath = message.path;
        options.onNavigate(message.path);
      } else if (!message.path && lastPath) {
        sendPartnerMessage(parent, origin, { type: "app.route", session, path: lastPath });
      }
      for (const id of pending.keys()) request(id);
      return;
    }
    if (!session || message.session !== session) return;
    if (message.type === "host.navigate" && message.path !== lastPath) {
      lastPath = message.path;
      options.onNavigate(message.path);
    }
    if (message.type === "host.assertion.result") {
      const result = pending.get(message.id);
      if (!result) return;
      pending.delete(message.id);
      clearTimeout(result.timer);
      if (message.assertion) result.resolve(message.assertion);
      else result.reject(new Error("The host could not issue a launch assertion."));
    }
  }

  const unwatch = watchNavigation(publishNavigation);
  appWindow.addEventListener("message", receive);
  hello();

  return {
    getAssertion(): Promise<string> {
      if (destroyed || parent === appWindow) return Promise.reject(new Error("The embedded bridge is unavailable."));
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("The host did not respond to the assertion request in time."));
        }, 10000);
        pending.set(id, { resolve, reject, timer });
        request(id);
      });
    },
    routeChanged(path: string) {
      if (!isAppPath(path)) throw new TypeError("Expected an app-relative route.");
      if (destroyed || path === lastPath) return;
      lastPath = path;
      if (session) sendPartnerMessage(parent, origin, { type: "app.route", session, path });
    },
    destroy() {
      destroyed = true;
      unwatch();
      appWindow.removeEventListener("message", receive);
      for (const result of pending.values()) {
        clearTimeout(result.timer);
        result.reject(new Error("The embedded bridge was disconnected."));
      }
      pending.clear();
    },
  };
}
