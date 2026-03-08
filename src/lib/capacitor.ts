import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

export const getPlatform = () => Capacitor.getPlatform();

// You can add more mobile-specific helpers here
// e.g., StatusBar, Haptics, etc.
