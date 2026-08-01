import {
  clearPrivateQueryCache,
  registerPrivateQueryCacheClearer,
} from '../src/privateQueryCache';

describe('cache privé React Query', () => {
  it('délègue la purge au client enregistré par l’application', () => {
    const clear = jest.fn();
    registerPrivateQueryCacheClearer(clear);

    clearPrivateQueryCache();

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
