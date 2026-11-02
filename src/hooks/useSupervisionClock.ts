import {useEffect, useState} from 'react';
import {gpsElapsedTime} from '../services/gpsClock';

/** One UI clock per visible screen, shared by all its device rows. No wall clock. */
export function useSupervisionClock(enabled: boolean) {
  const [elapsed, setElapsed] = useState(gpsElapsedTime);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const update = () => setElapsed(gpsElapsedTime());
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [enabled]);
  return elapsed;
}
