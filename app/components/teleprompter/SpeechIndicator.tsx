'use client';

import styles from './SpeechIndicator.module.css';

interface SpeechIndicatorProps {
  isListening: boolean;
  interimTranscript: string;
  confidence?: number;
  error?: string | null;
}

export default function SpeechIndicator({
  isListening,
  interimTranscript,
  confidence,
  error,
}: SpeechIndicatorProps) {
  if (!isListening && !error) return null;

  return (
    <div className={styles.container}>
      <div className={`${styles.micIcon} ${isListening ? styles.listening : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      </div>

      {interimTranscript && (
        <div className={styles.transcript}>
          {interimTranscript}
        </div>
      )}

      {confidence !== undefined && isListening && (
        <div className={styles.confidenceBar}>
          <div
            className={styles.confidenceFill}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      )}

      {error && (
        <div className={styles.error}>
          {error === 'not-allowed' ? 'Microphone access denied' : `Error: ${error}`}
        </div>
      )}
    </div>
  );
}
