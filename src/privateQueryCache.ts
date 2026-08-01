let clearPrivateCache: () => void = () => undefined;

export function registerPrivateQueryCacheClearer(clear: () => void): void {
  clearPrivateCache = clear;
}

export function clearPrivateQueryCache(): void {
  clearPrivateCache();
}
