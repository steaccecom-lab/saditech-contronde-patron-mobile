import React, { useEffect, useState } from 'react';
import { Alert, StatusBar } from 'react-native';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { restoreSession } from './src/services/authApi';
import { LoadingView } from './src/components/StateViews';
import { colors } from './src/theme/colors';
import { parseApiError } from './src/services/apiError';

const queryClient = new QueryClient({ mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => {
  if (mutation.options.meta?.silentError === true) {
    return;
  }
  const info = parseApiError(error);
  Alert.alert(info.title, info.messages.join('\n'), [{ text: info.field ? 'Corriger' : 'Fermer' }]);
} }) });

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setReady(true));
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        {ready ? <AppNavigator /> : <LoadingView label="Ouverture..." />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;
