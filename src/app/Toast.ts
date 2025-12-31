export class Toast {
  constructor(private element: HTMLElement) {}

  show(message: string, duration = 2000): void {
    this.element.textContent = message;
    this.element.classList.add("show");
    window.setTimeout(() => {
      this.element.classList.remove("show");
    }, duration);
  }
}
