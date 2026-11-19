import { isNavItem, type NavItem } from "./protocol.ts";

const tag = "sides-app-nav";
const changed = "sides:app-nav-change";

function registerNavigation(): void {
  if (customElements.get(tag)) return;
  customElements.define(tag, class extends HTMLElement {
    private observer = new MutationObserver(() => this.notify());
    private notify() {
      this.ownerDocument.dispatchEvent(new Event(changed));
    }
    connectedCallback() {
      this.hidden = true;
      this.observer.observe(this, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["href"], characterData: true,
      });
      this.notify();
    }
    disconnectedCallback() {
      this.observer.disconnect();
      this.notify();
    }
  });
}

export function readNavigation(): NavItem[] {
  const items: NavItem[] = [];
  for (const child of Array.from(document.querySelector(tag)?.children ?? [])) {
    if (child.localName !== "a") continue;
    const item = { label: child.textContent?.trim(), path: child.getAttribute("href") };
    if (isNavItem(item) && !items.some(existing => existing.path === item.path)) items.push(item);
    if (items.length === 32) break;
  }
  return items;
}

export function watchNavigation(onChange: () => void): () => void {
  registerNavigation();
  document.addEventListener(changed, onChange);
  return () => document.removeEventListener(changed, onChange);
}
