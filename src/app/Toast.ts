export class Toast {
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private element: HTMLElement) {
    this.element.setAttribute("role", "status");
    this.element.setAttribute("aria-live", "polite");
    this.element.setAttribute("aria-atomic", "true");
  }

  show(message: string, duration = 2000): void {
    this.element.textContent = message;
    this.element.classList.add("show");
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = setTimeout(() => {
      this.element.classList.remove("show");
      this.hideTimer = null;
    }, duration);
  }
}
