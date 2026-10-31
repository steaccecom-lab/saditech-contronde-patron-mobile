import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
/** Reuse the existing list query, and never poll while the app/screen is hidden. */
export function useBatteryRefresh() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => listener.remove();
  }, []);
  return focused && active ? 60000 : false;
}
