'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeleprompterSettings } from '@/app/hooks/useTeleprompterSettings';
import styles from './TeleprompterControls.module.css';

interface TeleprompterControlsProps {
  settings: TeleprompterSettings;
  onSettingsChange: (settings: Partial<TeleprompterSettings>) => void;
  isListening: boolean;
  onToggleListening: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  scrollMode: 'speech' | 'manual';
  onScrollModeChange: (mode: 'speech' | 'manual') => void;
  speechSupported: boolean;
}

export default function TeleprompterControls({
  settings,
  onSettingsChange,
  isListening,
  onToggleListening,
  isFullscreen,
  onToggleFullscreen,
  scrollMode,
  onScrollModeChange,
  speechSupported,
}: TeleprompterControlsProps) {
  const [visible, setVisible] = useState(true);
  const [lastActivity, setLastActivity] = useState(() => Date.now());

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

        {/* Divider */}
        <div className={styles.divider} />

        {/* Scroll Mode Toggle */}
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.button} ${scrollMode === 'speech' ? styles.active : ''}`}
            onClick={() => onScrollModeChange('speech')}
            disabled={!speechSupported}
            title={speechSupported ? 'Speech-controlled scrolling' : 'Speech not supported in this browser'}
          >
            🎤
          </button>
          <button
            className={`${styles.button} ${scrollMode === 'manual' ? styles.active : ''}`}
            onClick={() => onScrollModeChange('manual')}
            title="Manual scrolling (keyboard)"
          >
            ⌨️
          </button>
        </div>

        {/* Listen Toggle (when in speech mode) */}
        {scrollMode === 'speech' && speechSupported && (
          <button
            className={`${styles.button} ${isListening ? styles.listening : ''}`}
            onClick={onToggleListening}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? '⏸️' : '▶️'}
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
      </div>
    </div>
  );
}
