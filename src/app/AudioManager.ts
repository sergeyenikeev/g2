type BufferKey = "place" | "clear" | "combo" | "fail" | "button" | "music";

type UrlMap = Record<BufferKey, string>;

const SFX_KEYS = ["place", "clear", "combo", "fail", "button"] as const;
type SfxKey = (typeof SFX_KEYS)[number];

export class AudioManager {
  private unlocked = false;
  private muted = false;
  private sfxEnabled = true;
  private musicEnabled = true;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private loadPromise: Promise<void> | null = null;
  private musicElement: HTMLAudioElement | null = null;
  private pendingMusicStart = false;
  private sfxLevel = 0.62;
  private musicLevel = 0.34;
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
      SFX_KEYS.map(async (key) => {
        if (this.buffers[key]) {
          return;
        }
        try {
          const response = await fetch(this.urls[key]);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          this.buffers[key] = buffer;
        } catch (error) {
          console.warn(`Audio asset failed to load: ${key}`, error);
        }
      })
    )
      .then(() => {
        this.loadPromise = null;
        if (this.pendingMusicStart && this.musicEnabled) {
          this.startMusicInternal();
        }
      });

    return this.loadPromise;
  }

  unlock(): void {
    this.unlocked = true;
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

  async suspend(): Promise<void> {
    const ctx = this.context;
    if (!ctx || ctx.state === "suspended") {
      return;
    }
    try {
      await ctx.suspend();
    } catch {
    }
  }

  async resume(): Promise<void> {
    const ctx = this.context;
    if (!ctx || ctx.state !== "suspended") {
      return;
    }
    try {
      await ctx.resume();
    } catch {
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value ? 0 : 1;
    }
    this.syncMusicVolume();
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
    this.syncMusicVolume();
    if (value) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  startMusic(): void {
    if (!this.musicEnabled) {
      return;
    }
    if (!this.unlocked) {
      this.pendingMusicStart = true;
      return;
    }
    this.startMusicInternal();
  }

  stopMusic(): void {
    this.pendingMusicStart = false;
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
    }
  }

  playPlace(): void {
    this.playSfx("place", this.varyRate(1.0, 0.04), 0.54);
  }

  playClear(lines: number): void {
    const rate = this.varyRate(1 + Math.max(0, lines - 1) * 0.05, 0.02);
    this.playSfx("clear", rate, 0.66);
    if (lines > 1) {
      this.playSfx("clear", rate * 1.08, 0.3, 0.04);
    }
  }

  playCombo(): void {
    this.playSfx("combo", this.varyRate(1.0, 0.02), 0.52);
  }

  playFail(): void {
    this.playSfx("fail", this.varyRate(1.0, 0.02), 0.48);
  }

  playButton(): void {
    this.playSfx("button", this.varyRate(1.0, 0.03), 0.52);
  }

  private startMusicInternal(): void {
    if (!this.musicEnabled || this.muted) {
      return;
    }
    const music = this.ensureMusicElement();
    if (!music) {
      return;
    }
    this.syncMusicVolume();
    if (!music.paused) {
      this.pendingMusicStart = false;
      return;
    }
    const playPromise = music.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          this.pendingMusicStart = false;
        })
        .catch(() => {
          this.pendingMusicStart = true;
        });
      return;
    }
    this.pendingMusicStart = false;
  }

  private playSfx(key: SfxKey, rate: number, volume: number, delay = 0): void {
    if (this.muted || !this.sfxEnabled) {
      return;
    }
    const ctx = this.ensureContext();
    const buffer = this.buffers[key];
    if (!ctx || !buffer || !this.sfxGain) {
      this.playSfxFallback(key, rate, volume, delay);
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

  private playSfxFallback(key: SfxKey, rate: number, volume: number, delay = 0): void {
    const play = () => {
      const audio = new Audio(this.urls[key]);
      audio.preload = "auto";
      audio.volume = Math.min(1, Math.max(0, volume * 0.85));
      audio.playbackRate = rate;
      void audio.play().catch(() => {
      });
    };
    if (delay > 0) {
      window.setTimeout(play, delay * 1000);
      return;
    }
    play();
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (this.musicElement) {
      return this.musicElement;
    }
    const music = new Audio(this.urls.music);
    music.preload = "auto";
    music.loop = true;
    music.setAttribute("playsinline", "true");
    this.musicElement = music;
    this.syncMusicVolume();
    return music;
  }

  private syncMusicVolume(): void {
    if (!this.musicElement) {
      return;
    }
    this.musicElement.volume = this.musicEnabled && !this.muted ? this.musicLevel : 0;
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
    if (!this.unlocked) {
      return null;
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
