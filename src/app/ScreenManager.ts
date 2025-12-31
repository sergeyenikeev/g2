export class ScreenManager {
  private current: string | null = null;

  constructor(private screens: Record<string, HTMLElement>) {}

  show(id: string): void {
    Object.entries(this.screens).forEach(([key, element]) => {
      if (key === id) {
        element.classList.add("screen--active");
      } else {
        element.classList.remove("screen--active");
      }
    });
    this.current = id;
  }

  getCurrent(): string | null {
    return this.current;
  }
}
