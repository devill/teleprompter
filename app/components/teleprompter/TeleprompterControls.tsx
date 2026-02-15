'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeleprompterSettings } from '@/app/hooks/useTeleprompterSettings';
import styles from './TeleprompterControls.module.css';
import HelpModal from './HelpModal';

interface TeleprompterControlsProps {
  settings: TeleprompterSettings;
  onSettingsChange: (settings: Partial<TeleprompterSettings>) => void;
  isListening: boolean;
  onListeningToggle: () => void;
  isLoopMode: boolean;
  onLoopModeToggle: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  speechSupported: boolean;
  onPaste?: () => void;
}

export default function TeleprompterControls({
  settings,
  onSettingsChange,
  isListening,
  onListeningToggle,
  isLoopMode,
  onLoopModeToggle,
  isFullscreen,
  onToggleFullscreen,
  speechSupported,
  onPaste,
}: TeleprompterControlsProps) {
  const [visible, setVisible] = useState(true);
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [showHelp, setShowHelp] = useState(false);

  // Auto-hide after 3 seconds of inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > 3000) {
        setVisible(false);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [lastActivity]);

  // Show on mouse move
  useEffect(() => {
    const handleMouseMove = () => {
      setVisible(true);
      setLastActivity(Date.now());
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ fontSize: parseInt(e.target.value, 10) });
  }, [onSettingsChange]);

  const handleMarginChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ marginPercentage: parseInt(e.target.value, 10) });
  }, [onSettingsChange]);

  return (
    <div className={`${styles.overlay} ${visible ? '' : styles.hidden}`}>
      <div className={styles.panel}>
        {/* Font Size */}
        <div className={styles.control}>
          <label className={styles.label}>Size</label>
          <input
            type="range"
            min="24"
            max="72"
            value={settings.fontSize}
            onChange={handleFontSizeChange}
            className={styles.slider}
          />
          <span className={styles.value}>{settings.fontSize}px</span>
        </div>

        {/* Margins */}
        <div className={styles.control}>
          <label className={styles.label}>Margin</label>
          <input
            type="range"
            min="5"
            max="25"
            value={settings.marginPercentage}
            onChange={handleMarginChange}
            className={styles.slider}
          />
          <span className={styles.value}>{settings.marginPercentage}%</span>
        </div>

        {/* Paste */}
        {onPaste && (
          <button
            className={styles.button}
            onClick={onPaste}
            title="Paste script from clipboard"
          >
            📋
          </button>
        )}

        {/* Speech Recognition Toggle */}
        {speechSupported && (
          <button
            className={`${styles.button} ${isListening ? styles.listening : ''}`}
            onClick={onListeningToggle}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            🎤
          </button>
        )}

        {/* Loop Mode */}
        {speechSupported && (
          <button
            className={`${styles.button} ${isLoopMode ? styles.active : ''}`}
            onClick={onLoopModeToggle}
            title={isLoopMode ? 'Disable section loop' : 'Enable section loop'}
          >
            🔁
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          className={styles.button}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? '⊙' : '⛶'}
        </button>

        {/* Help */}
        <button
          className={styles.button}
          onClick={() => setShowHelp(true)}
          title="Show help"
        >
          ?
        </button>
      </div>

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
