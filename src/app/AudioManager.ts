type Channel = "sfx" | "music";

export class AudioManager {
  private muted = false;
  private sfxEnabled = true;
  private musicEnabled = true;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private sfxLevel = 0.6;
  private musicLevel = 0.22;

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

  setSfxEnabled(value: boolean): void {
    this.sfxEnabled = value;
    if (this.sfxGain) {
      this.sfxGain.gain.value = value ? this.sfxLevel : 0;
    }
  }

  setMusicEnabled(value: boolean): void {
    this.musicEnabled = value;
    if (this.musicGain) {
      this.musicGain.gain.value = value ? this.musicLevel : 0;
    }
    if (!value) {
      this.stopMusic();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.musicTimer !== null || !this.musicEnabled) {
      return;
    }
    this.musicTimer = window.setInterval(() => {
      this.playMusicStep();
    }, 360);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playPlace(): void {
    this.playTone(420, 0.09, "triangle", 0.08, "sfx");
    this.playTone(520, 0.07, "sine", 0.05, "sfx", 0.03);
  }

  playClear(lines: number): void {
    const base = 360 + Math.min(lines, 4) * 35;
    const intervals = lines <= 1 ? [0, 4] : lines === 2 ? [0, 4, 7] : [0, 4, 7, 11];
    intervals.forEach((semitone, index) => {
      const freq = base * this.semitoneRatio(semitone);
      this.playTone(freq, 0.18, "triangle", 0.08, "sfx", index * 0.04);
    });
  }

  playCombo(): void {
    this.playTone(720, 0.14, "triangle", 0.06, "sfx");
    this.playTone(880, 0.12, "sine", 0.05, "sfx", 0.05);
  }

  playFail(): void {
    this.playTone(220, 0.18, "sawtooth", 0.04, "sfx");
  }

  playButton(): void {
    this.playTone(360, 0.06, "sine", 0.05, "sfx");
  }

  private playMusicStep(): void {
    if (this.muted || !this.musicEnabled) {
      return;
    }
    const progression = [196, 220, 174, 246];
    const root = progression[this.musicStep % progression.length];
    const fifth = root * this.semitoneRatio(7);
    const octave = root * 2;
    this.musicStep += 1;
    this.playTone(root, 0.28, "sine", 0.03, "music");
    this.playTone(fifth, 0.24, "sine", 0.022, "music", 0.03);
    if (this.musicStep % 2 === 0) {
      this.playTone(octave, 0.18, "triangle", 0.018, "music", 0.08);
    }
  }

  private semitoneRatio(semitone: number): number {
    return Math.pow(2, semitone / 12);
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
    sfxGain.gain.value = this.sfxEnabled ? this.sfxLevel : 0;
    musicGain.gain.value = this.musicEnabled ? this.musicLevel : 0;

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
    channel: Channel,
    startDelay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) {
      return;
    }
    if (channel === "sfx" && !this.sfxEnabled) {
      return;
    }
    if (channel === "music" && !this.musicEnabled) {
      return;
    }
    const dest = channel === "music" ? this.musicGain : this.sfxGain;
    if (!dest) {
      return;
    }
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime + startDelay;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}
