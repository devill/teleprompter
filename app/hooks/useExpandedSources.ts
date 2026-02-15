import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'teleprompter_expanded_sources';
const DEFAULT_EXPANDED = ['my-scripts'];

interface StoredState {
  expanded: string[];
  known: string[];
}

function loadFromStorage(): StoredState | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Handle legacy format (plain array of expanded IDs)
    if (Array.isArray(parsed)) {
      return { expanded: parsed, known: parsed };
    }

    // New format with expanded and known arrays
    if (parsed && Array.isArray(parsed.expanded) && Array.isArray(parsed.known)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function saveToStorage(state: StoredState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useExpandedSources(sourceIds: string[]): {
  expandedSources: Set<string>;
  toggleSource: (id: string) => void;
} {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(() => {
    const saved = loadFromStorage();
    return new Set(saved?.expanded ?? DEFAULT_EXPANDED);
  });

  // Track known sources (lazy init via isInitialized)
  const knownSourceIds = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    const saved = loadFromStorage();
    knownSourceIds.current = new Set(saved?.known ?? sourceIds);
    isInitialized.current = true;
  }

  // Track latest sourceIds for save effect
  const sourceIdsRef = useRef(sourceIds);
  sourceIdsRef.current = sourceIds;

  // Track which sourceIds we've seen in this session (to detect removals)
  const seenSourceIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentKnown = knownSourceIds.current;
    const sourceIdSet = new Set(sourceIds);
    const currentSeen = seenSourceIds.current;
    const newSources = sourceIds.filter(id => !currentKnown.has(id));

    // Find sources that were seen before but are now removed
    const removedSources = [...currentSeen].filter(id => !sourceIdSet.has(id));

    // Update expandedSources
    setExpandedSources(prev => {
      let next = prev;

      // Add new sources
      if (newSources.length > 0) {
        next = new Set(next);
        for (const id of newSources) {
          next.add(id);
        }
      }

      // Remove only sources that we saw before but are now gone
      if (removedSources.length > 0) {
        if (next === prev) next = new Set(next);
        for (const id of removedSources) {
          next.delete(id);
        }
      }

      return next;
    });

    // Update tracking refs
    for (const id of newSources) {
      knownSourceIds.current.add(id);
    }
    for (const id of sourceIds) {
      seenSourceIds.current.add(id);
    }
    for (const id of removedSources) {
      seenSourceIds.current.delete(id);
    }
  }, [sourceIds]);

  // Save to localStorage, filtering to only include current sources
  useEffect(() => {
    const currentSourceIds = new Set(sourceIdsRef.current);
    saveToStorage({
      expanded: [...expandedSources].filter(id => currentSourceIds.has(id)),
      known: [...knownSourceIds.current].filter(id => currentSourceIds.has(id)),
    });
  }, [expandedSources, sourceIds]);

  const toggleSource = useCallback((id: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return { expandedSources, toggleSource };
}
