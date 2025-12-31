export class AudioManager {
  private muted = false;

  setMuted(value: boolean): void {
    this.muted = value;
  }

  isMuted(): boolean {
    return this.muted;
  }
}
