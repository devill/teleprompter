'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { myScriptsSource } from '@/app/lib/storage';
import { extractTitleFromContent, makeNameUnique } from '@/app/lib/scriptNaming';
import { htmlToMarkdown } from '@/app/lib/htmlToMarkdown';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return true;
  }
  return target.isContentEditable === true || target.contentEditable === 'true';
}

async function readClipboardContent(): Promise<string> {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        const html = await blob.text();
        return htmlToMarkdown(html);
      }
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain');
        return await blob.text();
      }
    }
    return '';
  } catch {
    return await navigator.clipboard.readText();
  }
}

export function usePasteHandler(existingScriptNames: string[]) {
  const router = useRouter();

  const handlePaste = useCallback(async () => {
    const content = await readClipboardContent();
    if (!content.trim()) {
      return;
    }

    const title = extractTitleFromContent(content);
    const name = makeNameUnique(title, existingScriptNames);
    const newScript = await myScriptsSource.createFile(name, content);
    router.push(`/teleprompter?id=${encodeURIComponent(newScript.id)}`);
  }, [existingScriptNames, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'v' || (!e.metaKey && !e.ctrlKey)) {
        return;
      }

      if (isEditableTarget(e.target)) {
        return;
      }

      e.preventDefault();
      handlePaste();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePaste]);
}
