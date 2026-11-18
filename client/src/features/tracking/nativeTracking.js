import { Capacitor, registerPlugin } from '@capacitor/core';
import { createNativeTrackingClient } from './nativeTrackingClient.js';
export const isNativeTracking = () => Capacitor.getPlatform() === 'android';
export const nativeTracking = createNativeTrackingClient(registerPlugin('CrewFitTracking'), () => {
  window.dispatchEvent(new Event('crewfit:gps-change'));
});
