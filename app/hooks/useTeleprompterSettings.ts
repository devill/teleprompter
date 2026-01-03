'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface TeleprompterSettings {
  fontSize: number;
  marginPercentage: number;
  scrollSpeed: number;
}

const DEFAULT_SETTINGS: TeleprompterSettings = {
  fontSize: 48,
  marginPercentage: 10,
  scrollSpeed: 5,
};

const STORAGE_KEY = 'autolektor_teleprompter_settings';

function getStoredSettings(): TeleprompterSettings | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as TeleprompterSettings;
  } catch {
    return null;
  }
}

function getCurrentSettings(): TeleprompterSettings {
  return getStoredSettings() ?? DEFAULT_SETTINGS;
}

function subscribeToSettings(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSettingsSnapshot(): TeleprompterSettings {
  return getCurrentSettings();
}

function getServerSnapshot(): TeleprompterSettings {
  return DEFAULT_SETTINGS;
}

export function useTeleprompterSettings() {
  const settings = useSyncExternalStore(
    subscribeToSettings,
    getSettingsSnapshot,
    getServerSnapshot
  );

  const updateSettings = useCallback(
    (updates: Partial<TeleprompterSettings>) => {
      const current = getCurrentSettings();
      const newSettings = { ...current, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    },
    []
  );

  return { settings, updateSettings };
}
