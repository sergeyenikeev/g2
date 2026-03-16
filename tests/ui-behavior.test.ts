import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenManager } from "../src/app/ScreenManager";
import { Toast } from "../src/app/Toast";

class MockClassList {
  private tokens = new Set<string>();

  constructor(initial: string[] = []) {
    initial.forEach((token) => this.tokens.add(token));
  }

  add(...tokens: string[]): void {
    tokens.forEach((token) => this.tokens.add(token));
  }

  remove(...tokens: string[]): void {
    tokens.forEach((token) => this.tokens.delete(token));
  }

  contains(token: string): boolean {
    return this.tokens.has(token);
  }

  toggle(token: string, force?: boolean): boolean {
    if (force === true) {
      this.tokens.add(token);
      return true;
    }
    if (force === false) {
      this.tokens.delete(token);
      return false;
    }
    if (this.tokens.has(token)) {
      this.tokens.delete(token);
      return false;
    }
    this.tokens.add(token);
    return true;
  }
}

class MockFocusable {
  focused = false;

  focus(): void {
    this.focused = true;
  }
}

class MockElement {
  classList: MockClassList;
  hidden = false;
  inert = false;
  tabIndex = -1;
  textContent = "";
  focused = false;
  private attrs = new Map<string, string>();
  private focusTarget: MockFocusable | null = null;

  constructor(initialClasses: string[] = []) {
    this.classList = new MockClassList(initialClasses);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setFocusTarget(target: MockFocusable | null): void {
    this.focusTarget = target;
  }

  querySelector(): MockFocusable | null {
    return this.focusTarget;
  }

  focus(): void {
    this.focused = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ScreenManager", () => {
  it("hides inactive screens from keyboard flow and accessibility tree", () => {
    const loading = new MockElement(["screen", "screen--active"]);
    const menu = new MockElement(["screen"]);
    const manager = new ScreenManager({
      loading: loading as unknown as HTMLElement,
      menu: menu as unknown as HTMLElement
    });

    expect(loading.hidden).toBe(false);
    expect(loading.getAttribute("aria-hidden")).toBe("false");
    expect(menu.hidden).toBe(true);
    expect(menu.getAttribute("aria-hidden")).toBe("true");
    expect(menu.inert).toBe(true);

    manager.show("menu");

    expect(loading.hidden).toBe(true);
    expect(loading.classList.contains("screen--active")).toBe(false);
    expect(loading.inert).toBe(true);
    expect(menu.hidden).toBe(false);
    expect(menu.classList.contains("screen--active")).toBe(true);
    expect(menu.getAttribute("aria-hidden")).toBe("false");
    expect(menu.inert).toBe(false);
  });

  it("focuses the first available control on the active screen", () => {
    const loading = new MockElement(["screen", "screen--active"]);
    const menu = new MockElement(["screen"]);
    const focusable = new MockFocusable();
    menu.setFocusTarget(focusable);
    const manager = new ScreenManager({
      loading: loading as unknown as HTMLElement,
      menu: menu as unknown as HTMLElement
    });

    manager.show("menu");

    expect(focusable.focused).toBe(true);
  });
});

describe("Toast", () => {
  it("restarts the hide timer when a new message is shown", () => {
    vi.useFakeTimers();
    const element = new MockElement();
    const toast = new Toast(element as unknown as HTMLElement);

    toast.show("one", 1000);
    expect(element.classList.contains("show")).toBe(true);

    vi.advanceTimersByTime(500);
    toast.show("two", 1000);

    vi.advanceTimersByTime(600);
    expect(element.textContent).toBe("two");
    expect(element.classList.contains("show")).toBe(true);

    vi.advanceTimersByTime(400);
    expect(element.classList.contains("show")).toBe(false);
  });

  it("sets polite live-region semantics for screen readers", () => {
    const element = new MockElement();
    const toast = new Toast(element as unknown as HTMLElement);

    toast.show("hello");

    expect(element.getAttribute("role")).toBe("status");
    expect(element.getAttribute("aria-live")).toBe("polite");
    expect(element.getAttribute("aria-atomic")).toBe("true");
  });
});
