// Web Audio for short game sounds. Off by default, one global toggle (stored in meta.sound), and
// nothing plays before a user gesture unlocks audio. Games register their two or three signature
// sounds under namespaced names such as "sticker-shock:correct".

/** A URL to a short audio file, or a function that synthesises the sound. */
export type SoundSource = string | ((ctx: AudioContext, destination: AudioNode) => void);

type AudioContextFactory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private unlocked = false;
  private readonly sources = new Map<string, SoundSource>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  constructor(private readonly createContext: AudioContextFactory = defaultFactory) {}

  register(name: string, source: SoundSource): void {
    this.sources.set(name, source);
    this.buffers.delete(name);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Call from a user gesture (click, key press). Creates or resumes the AudioContext. */
  unlock(): void {
    this.unlocked = true;
    try {
      this.ctx ??= this.createContext();
      if (this.ctx?.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  async play(name: string, volume = 0.6): Promise<void> {
    if (!this.enabled || !this.unlocked || !this.ctx) return;
    const source = this.sources.get(name);
    if (!source) return;
    const ctx = this.ctx;
    try {
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1, Math.max(0, volume));
      gain.connect(ctx.destination);
      if (typeof source === "function") {
        source(ctx, gain);
        return;
      }
      const buffer = await this.load(name, source);
      if (!buffer) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(gain);
      node.start();
    } catch {
      // Sound is decoration; never let it break a game.
    }
  }

  private load(name: string, url: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(name);
    if (!pending) {
      const ctx = this.ctx;
      pending = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
        .then((data) => (ctx ? ctx.decodeAudioData(data) : null))
        .catch(() => null);
      this.buffers.set(name, pending);
    }
    return pending;
  }
}

/** The app-wide engine. SoundProvider keeps it in sync with the player's setting. */
export const sound = new SoundEngine();

/** A short synthesised blip, handy for placeholders and /dev. */
export function blip(frequency = 660, durationMs = 90): SoundSource {
  return (ctx, destination) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const t = ctx.currentTime;
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.connect(env).connect(destination);
    osc.start(t);
    osc.stop(t + durationMs / 1000 + 0.02);
  };
}
