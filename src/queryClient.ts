import {Alert} from 'react-native';
import {MutationCache, QueryClient} from '@tanstack/react-query';
import {parseApiError} from './services/apiError';
import {registerPrivateQueryCacheClearer} from './privateQueryCache';

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.meta?.silentError === true) {
        return;
      }
      const info = parseApiError(error);
      Alert.alert(info.title, info.messages.join('\n'), [
        {text: info.field ? 'Corriger' : 'Fermer'},
      ]);
    },
  }),
});

registerPrivateQueryCacheClearer(() => queryClient.clear());
