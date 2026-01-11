'use client';

import type { JumpModeStatus } from '@/app/hooks/useTextMatcher';
import styles from './SpeechIndicator.module.css';

interface SpeechIndicatorProps {
  isListening: boolean;
  isReconnecting?: boolean;
  reconnectSuccess?: boolean;
  interimTranscript: string;
  confidence?: number;
  error?: string | null;
  jumpModeStatus: JumpModeStatus;
  jumpTargetText: string;
}

export default function SpeechIndicator({
  isListening,
  isReconnecting = false,
  reconnectSuccess = false,
  interimTranscript,
  confidence,
  error,
  jumpModeStatus,
  jumpTargetText,
}: SpeechIndicatorProps) {
  const showJumpMode = jumpModeStatus !== 'inactive';

  if (!isListening && !isReconnecting && !reconnectSuccess && !error && !showJumpMode) return null;

  return (
    <div className={styles.container}>
      {showJumpMode ? (
        <JumpModeIndicator status={jumpModeStatus} targetText={jumpTargetText} />
      ) : (
        <>
          <div className={`${styles.micIcon} ${isListening ? styles.listening : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>

          {isReconnecting && (
            <div className={styles.reconnecting}>
              <div className={styles.spinner} />
              <span>Reconnecting...</span>
            </div>
          )}

          {reconnectSuccess && (
            <div className={styles.reconnectSuccess}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span>Reconnected</span>
            </div>
          )}

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
              {error === 'not-allowed'
                ? 'Microphone access denied'
                : error === 'network'
                  ? 'Connection lost'
                  : `Error: ${error}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JumpModeIndicator({
  status,
  targetText,
}: {
  status: JumpModeStatus;
  targetText: string;
}) {
  const getStatusIcon = () => {
    switch (status) {
      case 'listening':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        );
      case 'searching':
        return (
          <div className={styles.spinner} />
        );
      case 'success':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      case 'no-match':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return 'Jump to:';
      case 'searching':
        return 'Searching...';
      case 'success':
        return 'Jumped to:';
      case 'no-match':
        return 'Not found:';
      default:
        return '';
    }
  };

  const statusClass = styles[`jump${status.charAt(0).toUpperCase() + status.slice(1)}`] || '';

  return (
    <div className={`${styles.jumpMode} ${statusClass}`}>
      <div className={styles.jumpIcon}>
        {getStatusIcon()}
      </div>
      <div className={styles.jumpContent}>
        <span className={styles.jumpLabel}>{getStatusText()}</span>
        {targetText && <span className={styles.jumpTarget}>{targetText}</span>}
      </div>
    </div>
  );
}
