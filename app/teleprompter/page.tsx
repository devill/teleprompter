'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseSections } from '@/app/lib/sectionParser';
import { useTeleprompterSettings } from '@/app/hooks/useTeleprompterSettings';
import { useFullscreen } from '@/app/hooks/useFullscreen';
import { useKeyboardControls } from '@/app/hooks/useKeyboardControls';
import { useSpeechRecognition } from '@/app/hooks/useSpeechRecognition';
import { useTextMatcher } from '@/app/hooks/useTextMatcher';
import TeleprompterView from '@/app/components/teleprompter/TeleprompterView';
import TeleprompterControls from '@/app/components/teleprompter/TeleprompterControls';
import SpeechIndicator from '@/app/components/teleprompter/SpeechIndicator';
import styles from './page.module.css';

function TeleprompterContent() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');

  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [manualLineIndex, setManualLineIndex] = useState(0);

  const viewerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollStartPositionRef = useRef(0);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasListeningBeforeScrollRef = useRef(false);

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

  // Fast scroll for jump mode (ease-in-out animation)
  const scrollToWordFast = useCallback((wordIndex: number) => {
    const container = viewerRef.current;
    const wordElement = container?.querySelector(`[data-word-index="${wordIndex}"]`) as HTMLElement | null;
    if (!container || !wordElement) return;

    const viewportHeight = container.clientHeight;
    const targetOffset = viewportHeight * 0.33;
    const wordTop = wordElement.offsetTop - container.offsetTop;
    const targetScrollTop = wordTop - targetOffset;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    if (Math.abs(distance) < 1) return;

    const duration = 400;
    const startTime = performance.now();

    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      container.scrollTop = startScrollTop + distance * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const {
    processTranscript,
    currentWordIndex,
    currentLineIndex,
    jumpModeStatus,
    jumpTargetText,
    setPosition,
  } = useTextMatcher({
    content,
    sectionAnchors,
    onMatch: (result) => scrollToWordFast(result.globalWordIndex),
  });

  // Continuous smooth scroll with velocity-based ease in/out
  const scrollVelocityRef = useRef(0);

  useEffect(() => {
    if (!isListening) return;

    const container = viewerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const smoothScroll = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
      lastTime = currentTime;

      const wordElement = container.querySelector(`[data-word-index="${currentWordIndex}"]`) as HTMLElement | null;
      if (!wordElement) {
        animationFrameId = requestAnimationFrame(smoothScroll);
        return;
      }

      const viewportHeight = container.clientHeight;
      const targetOffset = viewportHeight * 0.33;
      const wordTop = wordElement.offsetTop - container.offsetTop;
      const targetScrollTop = wordTop - targetOffset;
      const currentScrollTop = container.scrollTop;
      const error = targetScrollTop - currentScrollTop;

      // Velocity-based scrolling with acceleration/deceleration
      const maxVelocity = 600; // pixels per second
      const acceleration = 800; // pixels per second squared
      const deceleration = 1200; // pixels per second squared (faster decel for smooth stop)
      const deadZone = 2; // pixels - stop moving when this close

      // Calculate target velocity based on error
      let targetVelocity = 0;
      if (Math.abs(error) > deadZone) {
        // Scale velocity with distance, capped at maxVelocity
        const velocityScale = Math.min(Math.abs(error) / 100, 1);
        targetVelocity = Math.sign(error) * maxVelocity * velocityScale;
      }

      // Smoothly adjust current velocity towards target
      const currentVelocity = scrollVelocityRef.current;
      let newVelocity: number;

      if (Math.abs(targetVelocity) > Math.abs(currentVelocity)) {
        // Accelerating
        const accelAmount = acceleration * deltaTime;
        if (targetVelocity > currentVelocity) {
          newVelocity = Math.min(currentVelocity + accelAmount, targetVelocity);
        } else {
          newVelocity = Math.max(currentVelocity - accelAmount, targetVelocity);
        }
      } else {
        // Decelerating
        const decelAmount = deceleration * deltaTime;
        if (currentVelocity > 0) {
          newVelocity = Math.max(currentVelocity - decelAmount, Math.max(0, targetVelocity));
        } else {
          newVelocity = Math.min(currentVelocity + decelAmount, Math.min(0, targetVelocity));
        }
      }

      scrollVelocityRef.current = newVelocity;

      // Apply velocity
      if (Math.abs(newVelocity) > 0.1) {
        container.scrollTop = currentScrollTop + newVelocity * deltaTime;
      }

      animationFrameId = requestAnimationFrame(smoothScroll);
    };

    animationFrameId = requestAnimationFrame(smoothScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      scrollVelocityRef.current = 0; // Reset velocity when stopping
    };
  }, [isListening, currentWordIndex]);

  // Use speech line index when listening, manual when not
  const activeLineIndex = isListening ? currentLineIndex : manualLineIndex;

  // Process transcript when it changes (both final and interim for responsiveness)
  useEffect(() => {
    if (!isListening) return;
    const fullTranscript = transcript + ' ' + interimTranscript;
    if (fullTranscript.trim()) {
      processTranscript(fullTranscript);
    }
  }, [transcript, interimTranscript, processTranscript, isListening]);

  // Smooth scroll to line for manual mode (position at 1/3 viewport)
  const scrollToLineSmooth = useCallback((lineIndex: number) => {
    const container = viewerRef.current;
    const lineElement = container?.querySelector(`[data-line-index="${lineIndex}"]`) as HTMLElement | null;
    if (!container || !lineElement) return;

    const viewportHeight = container.clientHeight;
    const targetOffset = viewportHeight * 0.33;
    const lineTop = lineElement.offsetTop - container.offsetTop;
    const targetScrollTop = lineTop - targetOffset;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    if (Math.abs(distance) < 1) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const currentError = targetScrollTop - container.scrollTop;
      const minSpeed = 50;
      const maxSpeed = 800;
      const errorThreshold = 100;

      let speed: number;
      if (Math.abs(currentError) < errorThreshold) {
        speed = minSpeed;
      } else {
        const scaleFactor = Math.min(Math.abs(currentError) / errorThreshold, maxSpeed / minSpeed);
        speed = minSpeed * scaleFactor;
      }

      const maxMove = speed * deltaTime;
      const move = Math.sign(currentError) * Math.min(Math.abs(currentError), maxMove);

      if (Math.abs(currentError) > 1) {
        container.scrollTop += move;
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
  }, []);

  // Handle user scroll to move read head
  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    const MIN_SCROLL_DISTANCE = 100; // pixels to trigger manual override when listening
    const SCROLL_DEBOUNCE_MS = 150;
    const AUTO_RESUME_MS = 300;

    const handleScrollStart = () => {
      if (!isUserScrollingRef.current) {
        isUserScrollingRef.current = true;
        scrollStartPositionRef.current = container.scrollTop;
        wasListeningBeforeScrollRef.current = isListening;
      }
    };

    const findWordAtViewportPosition = (): number | null => {
      const viewportHeight = container.clientHeight;
      const targetY = container.scrollTop + viewportHeight * 0.33;

      // Find all word elements and get the one closest to target position
      const wordElements = container.querySelectorAll('[data-word-index]');
      let closestWord: { index: number; distance: number } | null = null;

      for (const el of wordElements) {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elementY = container.scrollTop + (rect.top - containerRect.top) + rect.height / 2;
        const distance = Math.abs(elementY - targetY);

        if (!closestWord || distance < closestWord.distance) {
          const wordIndex = parseInt(el.getAttribute('data-word-index') || '0', 10);
          closestWord = { index: wordIndex, distance };
        }
      }

      return closestWord?.index ?? null;
    };

    const handleScrollEnd = () => {
      const scrollDistance = Math.abs(container.scrollTop - scrollStartPositionRef.current);
      const wasListening = wasListeningBeforeScrollRef.current;

      // If was listening, only respond to significant scroll
      if (wasListening && scrollDistance < MIN_SCROLL_DISTANCE) {
        isUserScrollingRef.current = false;
        return;
      }

      // Find word at 1/3 viewport position and update read head
      const wordIndex = findWordAtViewportPosition();
      if (wordIndex !== null) {
        setPosition(wordIndex);
        setManualLineIndex(currentLineIndex); // sync manual line index
      }

      // If was listening, stop and auto-resume after delay
      if (wasListening && isListening) {
        stop();
        setTimeout(() => {
          start();
        }, AUTO_RESUME_MS);
      }

      isUserScrollingRef.current = false;
    };

    const handleScroll = () => {
      handleScrollStart();

      // Debounce the scroll end detection
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
      scrollDebounceRef.current = setTimeout(handleScrollEnd, SCROLL_DEBOUNCE_MS);
    };

    // Use wheel and touchmove to detect user-initiated scrolls
    const handleWheel = () => {
      handleScroll();
    };

    const handleTouchMove = () => {
      handleScroll();
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, [isListening, setPosition, currentLineIndex, start, stop]);

  // Keyboard navigation (for manual mode)
  const scrollUp = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = Math.max(0, prev - 1);
      scrollToLineSmooth(newIndex);
      return newIndex;
    });
  }, [scrollToLineSmooth]);

  const scrollDown = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = prev + 1;
      scrollToLineSmooth(newIndex);
      return newIndex;
    });
  }, [scrollToLineSmooth]);

  const pageUp = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = Math.max(0, prev - 5);
      scrollToLineSmooth(newIndex);
      return newIndex;
    });
  }, [scrollToLineSmooth]);

  const pageDown = useCallback(() => {
    setManualLineIndex(prev => {
      const newIndex = prev + 5;
      scrollToLineSmooth(newIndex);
      return newIndex;
    });
  }, [scrollToLineSmooth]);

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
      .then(setContent)
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
        currentWordIndex={isListening ? currentWordIndex : undefined}
      />

      <TeleprompterControls
        settings={settings}
        onSettingsChange={updateSettings}
        isListening={isListening}
        onToggleListening={() => (isListening ? stop() : start())}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
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
