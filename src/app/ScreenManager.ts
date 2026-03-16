const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

type ManagedScreen = HTMLElement & { inert?: boolean };

export class ScreenManager {
  private current: string | null = null;

  constructor(private screens: Record<string, HTMLElement>) {
    const initial =
      Object.entries(this.screens).find(([, element]) => element.classList.contains("screen--active"))?.[0] ??
      Object.keys(this.screens)[0] ??
      null;
    if (initial) {
      this.syncState(initial, false);
    }
  }

  show(id: string): void {
    this.syncState(id, true);
  }

  getCurrent(): string | null {
    return this.current;
  }

  private syncState(id: string, focusActive: boolean): void {
    Object.entries(this.screens).forEach(([key, element]) => {
      const active = key === id;
      element.classList.toggle("screen--active", active);
      element.hidden = !active;
      element.setAttribute("aria-hidden", active ? "false" : "true");
      if ("inert" in element) {
        (element as ManagedScreen).inert = !active;
      }
    });
    this.current = id;
    if (focusActive) {
      this.focusActiveScreen();
    }
  }

  private focusActiveScreen(): void {
    if (!this.current) {
      return;
    }
    const screen = this.screens[this.current];
    if (!screen) {
      return;
    }
    const focusTarget = screen.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (typeof focusTarget?.focus === "function") {
      focusTarget.focus();
      return;
    }
    if (typeof screen.focus === "function") {
      screen.focus();
    }
  }
}
