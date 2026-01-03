'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import MarkdownViewer from '../components/MarkdownViewer';
import RawViewer from '../components/RawViewer';
import ViewToggle from '../components/ViewToggle';
import ThemeToggle from '../components/ThemeToggle';
import CommentSidebar from '../components/CommentSidebar';
import NamePrompt from '../components/NamePrompt';
import { useCommentPositioning } from '@/app/hooks/useCommentPositioning';
import { useClickOutsideToClear } from '@/app/hooks/useClickOutsideToClear';
import {
  stripMarkers,
  getStrippedRegions,
  insertCommentMarkers,
  removeCommentMarkers,
} from '@/app/lib/markerParser';
import { Comment, PendingSelection, PENDING_COMMENT_ID } from '@/app/lib/commentPositioning';
import styles from './page.module.css';

type ViewType = 'rendered' | 'raw';

interface SelectionData {
  startIndex: number;
  endIndex: number;
  selectionTop: number;
}

interface MetaData {
  comments: Comment[];
}

const USERNAME_STORAGE_KEY = 'autolektor_username';

function EditPageContent() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');

  const [rawContent, setRawContent] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewType, setViewType] = useState<ViewType>('rendered');
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [newlyCreatedCommentId, setNewlyCreatedCommentId] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLElement | null>(null);

  const strippedContent = useMemo(() => stripMarkers(rawContent), [rawContent]);
  const strippedRegions = useMemo(() => getStrippedRegions(rawContent), [rawContent]);

  const { positions, sortedComments, setCommentHeight } = useCommentPositioning({
    comments,
    regions: strippedRegions,
    highlightedCommentId: showCommentForm ? PENDING_COMMENT_ID : highlightedCommentId,
    viewerContainerRef,
    pendingSelection: showCommentForm ? pendingSelection : null,
  });

  useEffect(() => {
    const storedName = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  useEffect(() => {
    if (!filePath) {
      setError('No file path provided');
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [fileResponse, metaResponse] = await Promise.all([
          fetch(`/api/file?path=${encodeURIComponent(filePath!)}`),
          fetch(`/api/meta?path=${encodeURIComponent(filePath!)}`),
        ]);

        if (!fileResponse.ok) {
          throw new Error(`Failed to load file: ${fileResponse.statusText}`);
        }

        const fileContent = await fileResponse.text();
        setRawContent(fileContent);

        if (metaResponse.ok) {
          const metaData: MetaData = await metaResponse.json();
          setComments(metaData.comments || []);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
        setLoading(false);
      }
    }

    loadData();
  }, [filePath]);

  const handleTextSelect = useCallback((data: SelectionData) => {
    setPendingSelection(data);
    if (!userName) {
      setShowNamePrompt(true);
    } else {
      setShowCommentForm(true);
    }
  }, [userName]);

  const handleNameSubmit = useCallback((name: string) => {
    localStorage.setItem(USERNAME_STORAGE_KEY, name);
    setUserName(name);
    setShowNamePrompt(false);
    setShowCommentForm(true);
  }, []);

  const handleNameCancel = useCallback(() => {
    setShowNamePrompt(false);
  }, []);

  const handleCommentSubmit = useCallback(async (commentText: string) => {
    if (!pendingSelection || !userName || !filePath) return;

    const commentId = uuidv4();

    // Insert markers into raw content
    const updatedRawContent = insertCommentMarkers(
      rawContent,
      pendingSelection.startIndex,
      pendingSelection.endIndex,
      commentId
    );

    const newComment: Comment = {
      id: commentId,
      author: userName,
      text: commentText,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...comments, newComment];

    try {
      // Save both file and meta
      const [fileResponse, metaResponse] = await Promise.all([
        fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
          method: 'PUT',
          body: updatedRawContent,
        }),
        fetch(`/api/meta?path=${encodeURIComponent(filePath)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: updatedComments }),
        }),
      ]);

      if (fileResponse.ok && metaResponse.ok) {
        setNewlyCreatedCommentId(newComment.id);
        setRawContent(updatedRawContent);
        setComments(updatedComments);
        setPendingSelection(null);
        setShowCommentForm(false);
        setTimeout(() => setNewlyCreatedCommentId(null), 200);
      }
    } catch {
      // Handle error silently for MVP
    }
  }, [pendingSelection, userName, filePath, rawContent, comments]);

  const handleCommentCancel = useCallback(() => {
    setShowCommentForm(false);
  }, []);

  const handleCommentClick = useCallback((commentId: string) => {
    setHighlightedCommentId(commentId);
  }, []);

  const handleHighlightClick = useCallback((commentId: string) => {
    setHighlightedCommentId(commentId);
  }, []);

  const handleClearInteraction = useCallback(() => {
    setHighlightedCommentId(null);
    setShowCommentForm(false);
  }, []);

  const { markSelectionMade } = useClickOutsideToClear({
    onClear: handleClearInteraction,
    isActive: highlightedCommentId !== null || showCommentForm,
  });

  const handleCommentDelete = useCallback(async (commentId: string) => {
    if (!filePath) return;

    // Remove markers from raw content
    const updatedRawContent = removeCommentMarkers(rawContent, commentId);
    const updatedComments = comments.filter(c => c.id !== commentId);

    try {
      const [fileResponse, metaResponse] = await Promise.all([
        fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
          method: 'PUT',
          body: updatedRawContent,
        }),
        fetch(`/api/meta?path=${encodeURIComponent(filePath)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: updatedComments }),
        }),
      ]);

      if (fileResponse.ok && metaResponse.ok) {
        setRawContent(updatedRawContent);
        setComments(updatedComments);
        if (highlightedCommentId === commentId) {
          setHighlightedCommentId(null);
        }
      }
    } catch {
      // Handle error silently for MVP
    }
  }, [filePath, rawContent, comments, highlightedCommentId]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div>Error loading file</div>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.filePath}>{filePath}</span>
        <div className={styles.headerControls}>
          <ViewToggle view={viewType} onViewChange={setViewType} />
          <ThemeToggle />
        </div>
      </header>
      <div className={styles.content}>
        <main className={styles.mainContent}>
          {viewType === 'rendered' ? (
            <MarkdownViewer
              content={strippedContent}
              regions={strippedRegions}
              highlightedCommentId={highlightedCommentId}
              pendingRegion={showCommentForm && pendingSelection ? {
                start: pendingSelection.startIndex,
                end: pendingSelection.endIndex,
              } : null}
              onTextSelect={handleTextSelect}
              onHighlightClick={handleHighlightClick}
              onSelectionMade={markSelectionMade}
              containerRef={viewerContainerRef as React.RefObject<HTMLDivElement | null>}
            />
          ) : (
            <RawViewer
              content={rawContent}
              regions={strippedRegions}
              highlightedCommentId={highlightedCommentId}
              pendingRegion={showCommentForm && pendingSelection ? {
                start: pendingSelection.startIndex,
                end: pendingSelection.endIndex,
              } : null}
              onTextSelect={handleTextSelect}
              onHighlightClick={handleHighlightClick}
              onSelectionMade={markSelectionMade}
              containerRef={viewerContainerRef as React.RefObject<HTMLPreElement | null>}
            />
          )}
        </main>
        <aside className={styles.sidebar}>
          <CommentSidebar
            comments={sortedComments}
            positions={positions}
            highlightedCommentId={highlightedCommentId}
            onCommentClick={handleCommentClick}
            onDelete={handleCommentDelete}
            onHeightMeasured={setCommentHeight}
            pendingForm={showCommentForm && pendingSelection ? {
              onSubmit: handleCommentSubmit,
              onCancel: handleCommentCancel,
            } : null}
            newlyCreatedCommentId={newlyCreatedCommentId}
          />
        </aside>
      </div>
      {showNamePrompt && (
        <NamePrompt onSubmit={handleNameSubmit} onCancel={handleNameCancel} />
      )}
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <EditPageContent />
    </Suspense>
  );
}
