import { sound, type SoundSource } from "@/lib/sound";

// Sticker Shock's sounds, synthesised with Web Audio (no audio files). Off by default: the frame's
// one sound toggle turns them on.

export const SOUNDS = {
  beep: "sticker-shock:beep",
  right: "sticker-shock:right",
  wrong: "sticker-shock:wrong",
  print: "sticker-shock:print",
} as const;

function envelope(ctx: AudioContext, start: number, attack: number, hold: number, release: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(1, start + attack);
  gain.gain.setValueAtTime(1, start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  return gain;
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  frequency: number,
  start: number,
  duration: number,
  level: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  const volume = ctx.createGain();
  volume.gain.value = level;
  osc.connect(envelope(ctx, start, 0.004, duration * 0.6, duration * 0.4)).connect(volume);
  volume.connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  return osc;
}

/** The scanner beep on each pick: a square wave around 2 kHz, 70 ms. */
export const scannerBeep: SoundSource = (ctx, out) => {
  tone(ctx, out, "square", 2000, ctx.currentTime, 0.07, 0.25);
};

/** Cha-ching: two quick bright notes. */
export const chaChing: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  tone(ctx, out, "triangle", 1318.5, t, 0.08, 0.5);
  tone(ctx, out, "square", 1318.5, t, 0.05, 0.08);
  tone(ctx, out, "triangle", 1760, t + 0.09, 0.22, 0.5);
  tone(ctx, out, "square", 2637, t + 0.09, 0.12, 0.06);
};

/** A low buzz, falling a little, through a low-pass filter. */
export const buzz: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.connect(out);
  const osc = tone(ctx, filter, "sawtooth", 120, t, 0.32, 0.45);
  osc.frequency.linearRampToValueAtTime(92, t + 0.32);
};

/** About a second of receipt-printer chatter: short bursts of filtered noise. */
export const printerChatter: SoundSource = (ctx, out) => {
  const t = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.1), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3200;
  filter.Q.value = 1.4;
  filter.connect(out);
  for (let i = 0; i < 18; i++) {
    const start = t + i * 0.055 + (i % 3) * 0.006;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const volume = ctx.createGain();
    volume.gain.value = 0.55;
    source.connect(envelope(ctx, start, 0.003, 0.018, 0.012)).connect(volume);
    volume.connect(filter);
    source.start(start, i * 0.05, 0.05);
  }
};

let registered = false;

/** Registers the sounds once, in the browser. */
export function registerSounds() {
  if (registered) return;
  registered = true;
  sound.register(SOUNDS.beep, scannerBeep);
  sound.register(SOUNDS.right, chaChing);
  sound.register(SOUNDS.wrong, buzz);
  sound.register(SOUNDS.print, printerChatter);
}
