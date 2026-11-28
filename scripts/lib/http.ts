export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with a timeout and retries on 429 / 5xx / network errors. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (res.status !== 429 && res.status < 500) return res;
      lastError = new Error(`${res.status} ${res.statusText} for ${url}`);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** i);
    } catch (err) {
      lastError = err;
      await sleep(1000 * 2 ** i);
    }
  }
  throw lastError;
}
