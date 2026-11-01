import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/** Hidden tab panels must not consume Android back events. */
export function useHardwareBack(onBack: () => boolean, active = true) {
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [onBack, active]);
}
