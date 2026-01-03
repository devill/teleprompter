'use client';

import { useCallback, useEffect, useState } from 'react';

export function useFullscreen(elementRef?: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const element = elementRef?.current ?? document.documentElement;
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    }
  }, [elementRef]);

  const exitFullscreen = useCallback(async () => {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}
