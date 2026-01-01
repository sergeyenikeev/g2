type BufferKey = "place" | "clear" | "combo" | "fail" | "button" | "music";

type UrlMap = Record<BufferKey, string>;

export class AudioManager {
  private muted = false;
  private sfxEnabled = true;
  private musicEnabled = true;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers: Partial<Record<BufferKey, AudioBuffer>> = {};
  private loadPromise: Promise<void> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private pendingMusicStart = false;
  private sfxLevel = 0.62;
  private musicLevel = 0.28;
  private urls: UrlMap = {
    place: new URL("../assets/audio/sfx_place.wav", import.meta.url).toString(),
    clear: new URL("../assets/audio/sfx_clear.wav", import.meta.url).toString(),
    combo: new URL("../assets/audio/sfx_combo.wav", import.meta.url).toString(),
    fail: new URL("../assets/audio/sfx_fail.wav", import.meta.url).toString(),
    button: new URL("../assets/audio/sfx_button.wav", import.meta.url).toString(),
    music: new URL("../assets/audio/music_loop.wav", import.meta.url).toString()
  };

  async load(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    const ctx = this.ensureContext();
    if (!ctx) {
      return Promise.resolve();
    }
    this.loadPromise = Promise.all(
      (Object.keys(this.urls) as BufferKey[]).map(async (key) => {
        const response = await fetch(this.urls[key]);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers[key] = buffer;
      })
    )
      .then(() => {
        if (this.pendingMusicStart && this.musicEnabled) {
          this.startMusicInternal();
        }
      })
      .catch(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    void this.load();
    if (this.pendingMusicStart && this.musicEnabled) {
      this.startMusicInternal();
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
    if (value) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicEnabled) {
      return;
    }
    if (this.musicSource) {
      return;
    }
    if (!this.buffers.music) {
      this.pendingMusicStart = true;
      void this.load();
      return;
    }
    this.startMusicInternal();
  }

  stopMusic(): void {
    this.pendingMusicStart = false;
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  playPlace(): void {
    this.playSfx("place", this.varyRate(1.0, 0.04), 0.7);
  }

  playClear(lines: number): void {
    const rate = this.varyRate(1 + Math.max(0, lines - 1) * 0.05, 0.02);
    this.playSfx("clear", rate, 0.85);
    if (lines > 1) {
      this.playSfx("clear", rate * 1.08, 0.4, 0.04);
    }
  }

  playCombo(): void {
    this.playSfx("combo", this.varyRate(1.0, 0.02), 0.85);
  }

  playFail(): void {
    this.playSfx("fail", this.varyRate(1.0, 0.02), 0.75);
  }

  playButton(): void {
    this.playSfx("button", this.varyRate(1.0, 0.03), 0.6);
  }

  private startMusicInternal(): void {
    if (!this.musicEnabled || this.muted) {
      return;
    }
    const ctx = this.ensureContext();
    const buffer = this.buffers.music;
    if (!ctx || !buffer || !this.musicGain) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
    this.pendingMusicStart = false;
  }

  private playSfx(key: BufferKey, rate: number, volume: number, delay = 0): void {
    if (this.muted || !this.sfxEnabled) {
      return;
    }
    const ctx = this.ensureContext();
    const buffer = this.buffers[key];
    if (!ctx || !buffer || !this.sfxGain) {
      void this.load();
      return;
    }
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(this.sfxGain);
    source.start(ctx.currentTime + delay);
  }

  private varyRate(base: number, spread: number): number {
    if (spread <= 0) {
      return base;
    }
    return base + (Math.random() * 2 - 1) * spread;
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
}
