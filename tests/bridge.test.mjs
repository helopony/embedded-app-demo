import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { createHostBridge } from "../apps/admin/bridge/index.ts";
import { createAppBridge } from "../apps/partner/bridge/index.ts";
import * as adminProtocol from "../apps/admin/bridge/protocol.ts";
import * as partnerProtocol from "../apps/partner/bridge/protocol.ts";

const hostOrigin = "https://admin.example";
const appOrigin = "https://partner.example";

function dispatch(target, source, origin, data) {
  target.dispatchEvent(Object.assign(new Event("message"), { source, origin, data }));
}

function sandbox(t, getAssertion = async () => "signed-test-assertion") {
  const host = new EventTarget();
  const app = new EventTarget();
  const frame = Object.assign(new EventTarget(), { contentWindow: app });
  const sent = [];
  function connect(receiver, sender, receiverOrigin, senderOrigin) {
    receiver.postMessage = (data, targetOrigin) => {
      assert.equal(targetOrigin, receiverOrigin);
      sent.push({ receiver, data });
      queueMicrotask(() => dispatch(receiver, sender, senderOrigin, data));
    };
  }
  connect(host, app, hostOrigin, appOrigin);
  connect(app, host, appOrigin, hostOrigin);
  app.parent = host;

  const doc = Object.assign(new EventTarget(), { querySelector: () => doc.menu });
  const elements = new Map();
  const saved = new Map();
  function mockGlobal(key, value) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  mockGlobal("window", app);
  mockGlobal("document", doc);
  mockGlobal("customElements", {
    get: name => elements.get(name),
    define: (name, component) => elements.set(name, component),
  });
  mockGlobal("HTMLElement", class { ownerDocument = doc; children = []; });
  mockGlobal("MutationObserver", class {
    constructor(callback) { this.callback = callback; }
    observe(element) { element.changed = this.callback; }
    disconnect() {}
  });

  let hostBridge, appBridge;
  const menus = [], hostRoutes = [], appRoutes = [], ready = [];
  function startHost() {
    globalThis.window = host;
    hostBridge = createHostBridge({
      frame, appOrigin, getAssertion,
      onReady: () => ready.push(true),
      onNavigation: items => menus.push(items),
      onRoute: path => hostRoutes.push(path),
    });
    return hostBridge;
  }
  function startApp() {
    globalThis.window = app;
    appBridge = createAppBridge({
      hostOrigin,
      onNavigate(path) {
        appRoutes.push(path);
        // A UI router may report the new path after applying a host-initiated update.
        appBridge.routeChanged(path);
      },
    });
    return appBridge;
  }
  t.after(() => {
    hostBridge?.destroy();
    appBridge?.destroy();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { startHost, startApp, doc, elements, host, app, frame, sent, menus, hostRoutes, appRoutes, ready };
}

test("late host handshake preserves its queued deep link and resolves an early assertion request", async t => {
  const s = sandbox(t);
  const app = s.startApp();
  const assertion = app.getAssertion();
  app.routeChanged("/overview");
  await setImmediate();
  const host = s.startHost();
  host.navigate("/forecasts");

  assert.equal(await assertion, "signed-test-assertion");
  assert.deepEqual(s.appRoutes, ["/forecasts"]);
  assert.deepEqual(s.hostRoutes, []);
  s.frame.dispatchEvent(new Event("load"));
  await setImmediate();
  assert.deepEqual(s.ready, [true]);

  app.routeChanged("/settings");
  await setImmediate();
  host.navigate("/settings");
  await setImmediate();
  assert.deepEqual(s.hostRoutes, ["/settings"]);
  assert.deepEqual(s.appRoutes, ["/forecasts"]);
});

test("native nav declaration publishes validated direct anchors and subsequent DOM updates", async t => {
  const s = sandbox(t);
  s.startHost();
  await setImmediate();
  s.startApp();
  await setImmediate();
  function link(text, path, localName = "a") {
    return { localName, textContent: text, getAttribute: () => path };
  }
  const menu = new (s.elements.get("workspace-app-nav"))();
  s.doc.menu = menu;
  menu.children = [
    link(" Overview ", "/overview"), link("Duplicate", "/overview"),
    link("External", "//outside.example"), link("Not an anchor", "/other", "div"),
  ];
  menu.connectedCallback();
  await setImmediate();
  assert.equal(menu.hidden, true);
  assert.deepEqual(s.menus.at(-1), [{ label: "Overview", path: "/overview" }]);
  menu.children = [link("Forecasts", "/forecasts")];
  menu.changed();
  await setImmediate();
  assert.deepEqual(s.menus.at(-1), [{ label: "Forecasts", path: "/forecasts" }]);
  s.doc.menu = null;
  menu.disconnectedCallback();
  await setImmediate();
  assert.deepEqual(s.menus.at(-1), []);
});

test("peers enforce origin, source, protocol and current session before acting", async t => {
  let issued = 0;
  const s = sandbox(t, async () => String(++issued));
  s.startHost();
  s.startApp();
  await setImmediate();
  const welcome = s.sent.find(e => e.data.type === "host.welcome").data;
  const auth = { ...welcome, type: "app.assertion.request", id: "request-one" };
  dispatch(s.host, s.app, "https://elsewhere.example", auth);
  dispatch(s.host, {}, appOrigin, auth);
  dispatch(s.host, s.app, appOrigin, { ...auth, version: 2 });
  dispatch(s.host, s.app, appOrigin, { ...auth, session: "other-session" });
  const go = { ...welcome, type: "host.navigate", path: "/other" };
  dispatch(s.app, s.host, "https://elsewhere.example", go);
  dispatch(s.app, {}, hostOrigin, go);
  assert.equal(issued, 0);
  assert.deepEqual(s.appRoutes, []);
  dispatch(s.host, s.app, appOrigin, auth);
  assert.equal(issued, 1);
});

test("destroy rejects pending requests and late results stay in their original frame session", async t => {
  let finish;
  const s = sandbox(t, () => new Promise(resolve => { finish = resolve; }));
  s.startHost();
  const app = s.startApp();
  await setImmediate();
  const result = app.getAssertion();
  await setImmediate();
  const rejection = assert.rejects(result, /disconnected/);
  app.destroy();
  await rejection;
  s.startApp();
  await setImmediate();
  finish("old-result");
  await setImmediate();
  assert.equal(s.sent.some(e => e.data.type === "host.assertion.result"), false);
});

test("unanswered authentication attempts have a bounded wait", async t => {
  const s = sandbox(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const app = s.startApp();
  const rejection = assert.rejects(app.getAssertion(), /in time/);
  t.mock.timers.tick(10000);
  await rejection;
});

test("protocol accepts app routes and rejects ambiguous origins and navigation", () => {
  for (const { isAppPath, parseOrigin } of [adminProtocol, partnerProtocol]) {
    assert.equal(parseOrigin("https://admin.example/"), hostOrigin);
    assert.throws(() => parseOrigin("https://admin.example/apps"));
    assert.equal(isAppPath("/forecasts?day=1#total"), true);
    for (const path of ["https://partner.example", "//elsewhere.example", "/x/..//elsewhere", "/\\elsewhere"]) {
      assert.equal(isAppPath(path), false);
    }
  }
  const envelope = { channel: "workspace.bridge", version: 1, session: "s" };
  const nav = { ...envelope, type: "app.navigation", items: [] };
  const go = { ...envelope, type: "host.navigate", path: "/overview" };
  assert.equal(adminProtocol.readPartnerMessage({ ...nav, items: [{}] }), undefined);
  assert.equal(partnerProtocol.readHostMessage({ ...go, path: "//elsewhere.example" }), undefined);
  assert.equal(adminProtocol.readPartnerMessage(go), undefined);
  assert.equal(partnerProtocol.readHostMessage(nav), undefined);
});
