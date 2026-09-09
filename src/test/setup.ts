// Vitest setup file (see vite.config.ts's test.setupFiles).
//
// Node 22+ ships its own native, experimental `localStorage`/`sessionStorage`
// globals (gated behind a `--localstorage-file` flag this repo doesn't set).
// Under this repo's Node 25 dev environment that native global wins over
// jsdom's proper Storage implementation and is a non-functional stub --
// `localStorage.setItem` throws "is not a function". Every data-layer module
// under test (auth.ts, auth-v2.ts, platform.ts, storefront.ts) reads/writes
// `window.localStorage` directly, so tests need a real, working
// implementation regardless of which Node version runs them. Replace both
// globals with a small in-memory polyfill rather than depending on Node/jsdom
// internals to sort out the conflict themselves.
class MemoryStorage implements Storage {
  #store = new Map<string, string>();

  get length() {
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }

  getItem(key: string) {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.#store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.#store.delete(key);
  }

  setItem(key: string, value: string) {
    this.#store.set(key, String(value));
  }
}

for (const property of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, property, { value: new MemoryStorage(), configurable: true, writable: true });
  if (typeof window !== 'undefined') Object.defineProperty(window, property, { value: globalThis[property], configurable: true, writable: true });
}
