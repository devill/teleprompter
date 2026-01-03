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

// Cached snapshot to satisfy useSyncExternalStore requirements
let cachedSettings: TeleprompterSettings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

function loadFromStorage(): TeleprompterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(stored) as TeleprompterSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function updateCache() {
  const newSettings = loadFromStorage();
  // Only update if actually different (compare by value)
  if (JSON.stringify(cachedSettings) !== JSON.stringify(newSettings)) {
    cachedSettings = newSettings;
    listeners.forEach(listener => listener());
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Initialize cache on first subscriber
  if (listeners.size === 1) {
    cachedSettings = loadFromStorage();
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      updateCache();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function getSnapshot(): TeleprompterSettings {
  return cachedSettings;
}

function getServerSnapshot(): TeleprompterSettings {
  return DEFAULT_SETTINGS;
}

export function useTeleprompterSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const updateSettings = useCallback(
    (updates: Partial<TeleprompterSettings>) => {
      const newSettings = { ...cachedSettings, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      cachedSettings = newSettings;
      listeners.forEach(listener => listener());
    },
    []
  );

  return { settings, updateSettings };
}
