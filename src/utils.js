export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// The timer stays referenced: between polls it is the only thing keeping the
// connector's event loop alive. Each wait removes its abort listener when it
// ends, so a long-running loop does not pile listeners onto the signal.
export async function sleep(ms, signal) {
  if (signal?.aborted) return;
  await new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
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
