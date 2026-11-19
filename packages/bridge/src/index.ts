import { isAppPath, parseOrigin, readMessage, sendMessage, type NavItem } from "./protocol.ts";
import { readNavigation, watchNavigation } from "./navigation.ts";

export type { NavItem } from "./protocol.ts";

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
    const message = readMessage(event.data);
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
    if (!session || !("session" in message) || message.session !== session) return;
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
    if (parent !== appWindow) sendMessage(parent, origin, { type: "app.hello", instance });
  }
  function publishNavigation() {
    if (session) sendMessage(parent, origin, { type: "app.navigation", session, items: readNavigation() });
  }
  function request(id: string) {
    if (session) sendMessage(parent, origin, { type: "app.assertion.request", session, id });
  }

  function receive(event: MessageEvent) {
    if (parent === appWindow || event.origin !== origin || event.source !== parent) return;
    const message = readMessage(event.data);
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
        sendMessage(parent, origin, { type: "app.route", session, path: lastPath });
      }
      for (const id of pending.keys()) request(id);
      return;
    }
    if (!session || !("session" in message) || message.session !== session) return;
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
      if (session) sendMessage(parent, origin, { type: "app.route", session, path });
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
