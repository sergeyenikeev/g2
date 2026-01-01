type Channel = "sfx" | "music";

export class AudioManager {
  private muted = false;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value ? 0 : 1;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.musicTimer !== null) {
      return;
    }
    this.musicTimer = window.setInterval(() => {
      this.playMusicStep();
    }, 320);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playPlace(): void {
    this.playTone(420, 0.08, "triangle", 0.08, "sfx");
  }

  playClear(lines: number): void {
    const base = 520 + Math.min(lines, 4) * 50;
    this.playTone(base, 0.12, "sine", 0.1, "sfx");
    if (lines > 1) {
      this.playTone(base * 1.4, 0.1, "sine", 0.06, "sfx");
    }
  }

  playCombo(): void {
    this.playTone(760, 0.16, "square", 0.06, "sfx");
  }

  playFail(): void {
    this.playTone(190, 0.2, "sawtooth", 0.05, "sfx");
  }

  playButton(): void {
    this.playTone(360, 0.06, "sine", 0.05, "sfx");
  }

  private playMusicStep(): void {
    if (this.muted) {
      return;
    }
    const pattern = [262, 294, 330, 392, 330, 294, 330, 392];
    const freq = pattern[this.musicStep % pattern.length];
    this.musicStep += 1;
    this.playTone(freq, 0.2, "sine", 0.03, "music");
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }
    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    const ctx = new AudioCtor();
    const masterGain = ctx.createGain();
    const sfxGain = ctx.createGain();
    const musicGain = ctx.createGain();

    masterGain.gain.value = this.muted ? 0 : 1;
    sfxGain.gain.value = 0.7;
    musicGain.gain.value = 0.3;

    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.context = ctx;
    this.masterGain = masterGain;
    this.sfxGain = sfxGain;
    this.musicGain = musicGain;
    return ctx;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    channel: Channel
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) {
      return;
    }
    const dest = channel === "music" ? this.musicGain : this.sfxGain;
    if (!dest) {
      return;
    }
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}
