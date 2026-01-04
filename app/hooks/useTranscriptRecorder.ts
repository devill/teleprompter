'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  formatTranscript,
  generateTranscriptPath,
  type TranscriptEntry,
} from '@/app/lib/transcriptRecorder';
import type { DocumentWord } from '@/app/lib/speechMatcher';

interface UseTranscriptRecorderProps {
  filePath: string | null;
  words: DocumentWord[];
  isRecording: boolean;
}

interface UseTranscriptRecorderReturn {
  recordWord: (globalWordIndex: number) => void;
  recordCommand: (commandText: string) => void;
}

export function useTranscriptRecorder({
  filePath,
  words,
  isRecording,
}: UseTranscriptRecorderProps): UseTranscriptRecorderReturn {
  const entriesRef = useRef<TranscriptEntry[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const prevIsRecordingRef = useRef(false);

  const recordWord = useCallback((globalWordIndex: number) => {
    const word = words[globalWordIndex]?.word;
    if (word) {
      entriesRef.current.push({ type: 'word', text: word });
    }
  }, [words]);

  const recordCommand = useCallback((commandText: string) => {
    entriesRef.current.push({ type: 'command', text: commandText });
  }, []);

  const save = useCallback(async () => {
    if (!filePath || entriesRef.current.length === 0 || !startTimeRef.current) {
      console.log('[TranscriptRecorder] save skipped:', { filePath: !!filePath, entries: entriesRef.current.length, startTime: !!startTimeRef.current });
      return;
    }

    const transcript = formatTranscript(entriesRef.current);
    const transcriptPath = generateTranscriptPath(filePath, startTimeRef.current);
    console.log('[TranscriptRecorder] saving to:', transcriptPath, 'entries:', entriesRef.current.length);

    try {
      const response = await fetch(`/api/file?path=${encodeURIComponent(transcriptPath)}`, {
        method: 'PUT',
        body: transcript,
      });
      if (!response.ok) {
        console.error('[TranscriptRecorder] save failed:', response.status, await response.text());
      } else {
        console.log('[TranscriptRecorder] saved successfully');
      }
    } catch (error) {
      console.error('[TranscriptRecorder] save error:', error);
    }

    entriesRef.current = [];
    startTimeRef.current = null;
  }, [filePath]);

  useEffect(() => {
    const wasRecording = prevIsRecordingRef.current;
    prevIsRecordingRef.current = isRecording;

    if (isRecording && !wasRecording) {
      console.log('[TranscriptRecorder] started recording');
      entriesRef.current = [];
      startTimeRef.current = new Date();
    }

    if (!isRecording && wasRecording) {
      console.log('[TranscriptRecorder] stopped recording, triggering save');
      save();
    }
  }, [isRecording, save]);

  return { recordWord, recordCommand };
}
