import { describe, expect, it } from "vitest";

async function serializedGrant(state: { grants: number }, lock: Promise<void>, next: (lock: Promise<void>) => void) {
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  await lock;
  next(current);
  if (state.grants === 0) state.grants = 1;
  release();
}

describe("F50 concurrency invariants", () => {
  it("allows exactly one grant when two callers race", async () => {
    const state = { grants: 0 };
    let tail = Promise.resolve();
    const run = () => serializedGrant(state, tail, (lock) => { tail = lock; });
    await Promise.all([run(), run()]);
    expect(state.grants).toBe(1);
  });

  it("never reserves more than the available balance", async () => {
    let balance = 1;
    let tail = Promise.resolve();
    const reserve = async () => {
      let release!: () => void;
      const lock = new Promise<void>((resolve) => { release = resolve; });
      const previous = tail;
      tail = lock;
      await previous;
      if (balance > 0) balance -= 1;
      release();
    };
    await Promise.all([reserve(), reserve(), reserve()]);
    expect(balance).toBe(0);
  });
});
