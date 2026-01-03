'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stripMarkers } from '@/app/lib/markerParser';
import { parseSections } from '@/app/lib/sectionParser';
import { useTeleprompterSettings } from '@/app/hooks/useTeleprompterSettings';
import { useFullscreen } from '@/app/hooks/useFullscreen';
import { useKeyboardControls } from '@/app/hooks/useKeyboardControls';
import { useSpeechRecognition } from '@/app/hooks/useSpeechRecognition';
import { useTextMatcher } from '@/app/hooks/useTextMatcher';
import type { MatchResult } from '@/app/lib/speechMatcher';
import TeleprompterView from '@/app/components/teleprompter/TeleprompterView';
import TeleprompterControls from '@/app/components/teleprompter/TeleprompterControls';
import SpeechIndicator from '@/app/components/teleprompter/SpeechIndicator';
import styles from './page.module.css';

function TeleprompterContent() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');

  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scrollMode, setScrollMode] = useState<'speech' | 'manual'>('manual');
  const [manualLineIndex, setManualLineIndex] = useState(0);

  const viewerRef = useRef<HTMLDivElement>(null);

  const { settings, updateSettings } = useTeleprompterSettings();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    error: speechError,
  } = useSpeechRecognition();

  const sectionAnchors = useMemo(() => parseSections(content), [content]);

  const scrollToLine = useCallback((lineIndex: number) => {
    const lineElement = viewerRef.current?.querySelector(`[data-line-index="${lineIndex}"]`);
    // Use 'start' - the CSS padding positions this at 1/3 from top
    lineElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleMatch = useCallback((result: MatchResult) => {
    scrollToLine(result.lineIndex);
  }, [scrollToLine]);

  const {
    processTranscript,
    currentWordIndex,
    currentLineIndex,
    jumpModeStatus,
    jumpTargetText,
  } = useTextMatcher({
    content,
    sectionAnchors,
    onMatch: handleMatch,
  });

  // Use speech line index when listening, manual when not
  const activeLineIndex = scrollMode === 'speech' && isListening ? currentLineIndex : manualLineIndex;

  // Process transcript when it changes (both final and interim for responsiveness)
  useEffect(() => {
    if (!isListening) return;
    const fullTranscript = transcript + ' ' + interimTranscript;
    if (fullTranscript.trim()) {
      processTranscript(fullTranscript);
    }
  }, [transcript, interimTranscript, processTranscript, isListening]);

  // Keyboard navigation (for manual mode)
  const scrollUp = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = Math.max(0, prev - 1);
      scrollToLine(newIndex);
      return newIndex;
    });
  }, [scrollToLine]);

  const scrollDown = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = prev + 1;
      scrollToLine(newIndex);
      return newIndex;
    });
  }, [scrollToLine]);

  const pageUp = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = Math.max(0, prev - 5);
      scrollToLine(newIndex);
      return newIndex;
    });
  }, [scrollToLine]);

  const pageDown = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = prev + 5;
      scrollToLine(newIndex);
      return newIndex;
    });
  }, [scrollToLine]);

  const togglePause = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  useKeyboardControls({
    onScrollUp: scrollUp,
    onScrollDown: scrollDown,
    onPageUp: pageUp,
    onPageDown: pageDown,
    onTogglePause: togglePause,
    onEscape: () => {
      if (isFullscreen) toggleFullscreen();
    },
  });

  // Apply teleprompter theme
  useEffect(() => {
    document.documentElement.setAttribute('data-teleprompter', 'true');
    return () => {
      document.documentElement.removeAttribute('data-teleprompter');
    };
  }, []);

  // Load file content
  useEffect(() => {
    if (!filePath) return;

    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.text();
      })
      .then(rawContent => setContent(stripMarkers(rawContent)))
      .catch(err => setError(err.message));
  }, [filePath]);

  if (!filePath) {
    return <div className={styles.error}>No file path specified</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!content) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <TeleprompterView
        ref={viewerRef}
        content={content}
        fontSize={settings.fontSize}
        marginPercentage={settings.marginPercentage}
        currentLineIndex={activeLineIndex}
        currentWordIndex={scrollMode === 'speech' ? currentWordIndex : undefined}
      />

      <TeleprompterControls
        settings={settings}
        onSettingsChange={updateSettings}
        isListening={isListening}
        onToggleListening={() => (isListening ? stop() : start())}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        scrollMode={scrollMode}
        onScrollModeChange={setScrollMode}
        speechSupported={isSupported}
      />

      <SpeechIndicator
        isListening={isListening}
        interimTranscript={interimTranscript}
        error={speechError}
        jumpModeStatus={jumpModeStatus}
        jumpTargetText={jumpTargetText}
      />
    </>
  );
}

export default function TeleprompterPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <TeleprompterContent />
    </Suspense>
  );
}
