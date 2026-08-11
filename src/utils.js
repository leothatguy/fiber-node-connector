export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function sleep(ms, signal) {
  if (signal?.aborted) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    timeout.unref?.();
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

export function nextBackoff(current, minimum, maximum) {
  const base = current <= 0 ? minimum : Math.min(maximum, current * 2);
  const jitter = Math.floor(base * 0.2 * Math.random());
  return Math.min(maximum, base + jitter);
}

export function normalizeStatus(value) {
  return String(value ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}
