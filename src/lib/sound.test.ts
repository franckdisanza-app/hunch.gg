import { SoundEngine } from "./sound";

function fakeContext() {
  return {
    state: "suspended",
    resume: vi.fn().mockResolvedValue(undefined),
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
  } as unknown as AudioContext;
}

describe("SoundEngine", () => {
  it("plays nothing before a user gesture, even when enabled", async () => {
    const synth = vi.fn();
    const engine = new SoundEngine(fakeContext);
    engine.register("demo:tap", synth);
    engine.setEnabled(true);
    await engine.play("demo:tap");
    expect(synth).not.toHaveBeenCalled();
  });

  it("is off by default", async () => {
    const synth = vi.fn();
    const engine = new SoundEngine(fakeContext);
    engine.register("demo:tap", synth);
    engine.unlock();
    await engine.play("demo:tap");
    expect(engine.isEnabled()).toBe(false);
    expect(synth).not.toHaveBeenCalled();
  });

  it("plays registered sounds once unlocked and enabled", async () => {
    const synth = vi.fn();
    const ctx = fakeContext();
    const engine = new SoundEngine(() => ctx);
    engine.register("demo:tap", synth);
    engine.setEnabled(true);
    engine.unlock();
    await engine.play("demo:tap");
    expect(ctx.resume).toHaveBeenCalled();
    expect(synth).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown sounds and a missing Web Audio API", async () => {
    const engine = new SoundEngine(() => null);
    engine.setEnabled(true);
    engine.unlock();
    await expect(engine.play("nothing")).resolves.toBeUndefined();
  });
});
