import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { restoreSession } from './src/services/authApi';
import { LoadingView } from './src/components/StateViews';
import { colors } from './src/theme/colors';

const queryClient = new QueryClient();

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
