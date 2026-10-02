import { sound, type SoundSource } from "@/lib/sound";
import type { Band } from "./config";

// Ping's sounds, synthesised with Web Audio (no audio files). Off by default: the frame's one
// sound toggle turns them on. The sonar ping rises in pitch the closer the pin; the direction hint
// has a pitch of its own (a "this way" chirp), so it never tells how close.

export const SOUNDS = {
  ping: (band: Band) => `ping:ping-${band}`,
  bearing: "ping:bearing",
  sweep: "ping:sweep",
  squeak: "ping:squeak",
} as const;

/** Sonar pitch per band, Hz: a fifth apart, low when freezing, high when burning. */
const PITCH: Record<Band, number> = {
  freezing: 392,
  cold: 494,
  warm: 622,
  hot: 784,
  burning: 988,
};

function decay(ctx: AudioContext, start: number, peak: number, seconds: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  return gain;
}

/** A soft sonar ping: a sine with a tiny downward bend, a long tail and a quieter echo. */
export function sonar(frequency: number): SoundSource {
  return (ctx, out) => {
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.connect(out);
    for (const [delay, level] of [
      [0, 0.8],
      [0.28, 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency * 1.04, t + delay);
      osc.frequency.exponentialRampToValueAtTime(frequency, t + delay + 0.06);
      osc.connect(decay(ctx, t + delay, level, 1.3)).connect(filter);
      osc.start(t + delay);
      osc.stop(t + delay + 1.4);
    }
  };
}

/** The direction hint: two quick, soft blips stepping up, the same wherever the answer is. */
export const bearing: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  for (const [start, frequency] of [
    [0, 660],
    [0.11, 880],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, t + start);
    osc.connect(decay(ctx, t + start, 0.5, 0.18)).connect(out);
    osc.start(t + start);
    osc.stop(t + start + 0.2);
  }
};

/** The radar sweep at the reveal: filtered noise swelling up and away. */
export const sweep: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  const length = 1.3;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 3;
  filter.frequency.setValueAtTime(350, t);
  filter.frequency.exponentialRampToValueAtTime(1800, t + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  source.connect(filter).connect(gain).connect(out);
  source.start(t);
  source.stop(t + length);
};

/** A small balloon squeak for a bullseye: two quick upward slides with a wobble. */
export const squeak: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  for (const [start, from, to] of [
    [0, 700, 1300],
    [0.16, 900, 1600],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(from, t + start);
    osc.frequency.exponentialRampToValueAtTime(to, t + start + 0.12);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 28;
    const depth = ctx.createGain();
    depth.gain.value = 45;
    wobble.connect(depth).connect(osc.frequency);
    osc.connect(decay(ctx, t + start, 0.45, 0.16)).connect(out);
    osc.start(t + start);
    wobble.start(t + start);
    osc.stop(t + start + 0.2);
    wobble.stop(t + start + 0.2);
  }
};

let registered = false;

/** Registers the sounds once, in the browser. */
export function registerSounds() {
  if (registered) return;
  registered = true;
  for (const [band, frequency] of Object.entries(PITCH) as [Band, number][]) {
    sound.register(SOUNDS.ping(band), sonar(frequency));
  }
  sound.register(SOUNDS.bearing, bearing);
  sound.register(SOUNDS.sweep, sweep);
  sound.register(SOUNDS.squeak, squeak);
}
