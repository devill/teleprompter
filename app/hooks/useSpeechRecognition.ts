'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API type declarations (not included in standard TypeScript DOM types)
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;        // Browser supports Speech API
  isListening: boolean;        // Currently listening
  isReconnecting: boolean;     // Attempting to reconnect after network error
  reconnectSuccess: boolean;   // Just reconnected successfully (brief flash)
  transcript: string;          // Final recognized text
  interimTranscript: string;   // In-progress text
  start: () => void;
  stop: () => void;
  error: string | null;
}

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4000;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  // Initialize to false for SSR, update after hydration to avoid mismatch
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectSuccess, setReconnectSuccess] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Track intended state to ignore stale onend events
  const wantToListenRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track reconnection state in ref so onend can check it
  const isReconnectingRef = useRef(false);

  // Check browser support after hydration
  useEffect(() => {
    setIsSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const scheduleRetry = () => {
      if (retryCountRef.current >= MAX_RETRIES) {
        isReconnectingRef.current = false;
        setError('network');
        setIsReconnecting(false);
        setIsListening(false);
        wantToListenRef.current = false;
        return;
      }

      const delay = Math.min(
        BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current),
        MAX_RETRY_DELAY_MS
      );
      retryCountRef.current += 1;

      retryTimeoutRef.current = setTimeout(() => {
        if (wantToListenRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            scheduleRetry();
          }
        }
      }, delay);
    };

    recognition.onstart = () => {
      retryCountRef.current = 0;

      // Show success message if we just recovered from reconnection
      if (isReconnectingRef.current) {
        isReconnectingRef.current = false;
        setIsReconnecting(false);
        setReconnectSuccess(true);
        // Clear any existing success timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        // Auto-hide success message after 2 seconds
        successTimeoutRef.current = setTimeout(() => {
          setReconnectSuccess(false);
        }, 2000);
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + ' ' + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'network' && wantToListenRef.current) {
        isReconnectingRef.current = true;
        setIsReconnecting(true);
        scheduleRetry();
      } else {
        wantToListenRef.current = false;
        setError(event.error);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Don't interfere if we're handling a network reconnection
      if (isReconnectingRef.current) {
        return;
      }

      if (wantToListenRef.current) {
        // We still want to listen but recognition stopped (browser timeout, etc.)
        // Auto-restart after a brief delay to avoid rapid restart loops
        setTimeout(() => {
          if (wantToListenRef.current && recognitionRef.current && !isReconnectingRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              // Failed to restart - give up
              wantToListenRef.current = false;
              setIsListening(false);
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      recognition.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    // Set intention first to prevent stale onend from resetting state
    wantToListenRef.current = true;
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // start() throws if already started - reset intention
      wantToListenRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    wantToListenRef.current = false;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    isReconnecting,
    reconnectSuccess,
    transcript,
    interimTranscript,
    start,
    stop,
    error,
  };
}
