'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import MarkdownViewer from '../components/MarkdownViewer';
import RawViewer from '../components/RawViewer';
import ViewToggle from '../components/ViewToggle';
import CommentSidebar from '../components/CommentSidebar';
import CommentForm from '../components/CommentForm';
import NamePrompt from '../components/NamePrompt';
import styles from './page.module.css';

type ViewType = 'rendered' | 'raw';

interface TextSelectionData {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  anchor: TextSelectionData;
  createdAt: string;
}

interface MetaData {
  comments: Comment[];
}

const USERNAME_STORAGE_KEY = 'autolektor_username';

function EditPageContent() {
  const searchParams = useSearchParams();
  const filePath = searchParams.get('path');

  const [content, setContent] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewType, setViewType] = useState<ViewType>('rendered');
  const [selectedAnchor, setSelectedAnchor] = useState<TextSelectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

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
        setContent(fileContent);

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

  const handleTextSelect = useCallback((data: TextSelectionData) => {
    setSelectedAnchor(data);
    setShowCommentForm(false);
  }, []);

  const handleAddCommentClick = useCallback(() => {
    if (!selectedAnchor) return;

    if (!userName) {
      setShowNamePrompt(true);
    } else {
      setShowCommentForm(true);
    }
  }, [selectedAnchor, userName]);

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
    if (!selectedAnchor || !userName || !filePath) return;

    const newComment: Comment = {
      id: uuidv4(),
      author: userName,
      text: commentText,
      anchor: selectedAnchor,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...comments, newComment];

    try {
      const response = await fetch(`/api/meta?path=${encodeURIComponent(filePath)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: updatedComments }),
      });

      if (response.ok) {
        setComments(updatedComments);
        setSelectedAnchor(null);
        setShowCommentForm(false);
      }
    } catch {
      // Handle error silently for MVP
    }
  }, [selectedAnchor, userName, filePath, comments]);

  const handleCommentCancel = useCallback(() => {
    setShowCommentForm(false);
  }, []);

  const handleCommentClick = useCallback((commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      // For now, just log - scroll-to-text will be implemented in polish phase
      console.log('Clicked comment:', comment.anchor.selectedText);
    }
  }, [comments]);

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
        <ViewToggle view={viewType} onViewChange={setViewType} />
      </header>
      <div className={styles.content}>
        <main className={styles.mainContent}>
          {viewType === 'rendered' ? (
            <MarkdownViewer content={content} onTextSelect={handleTextSelect} />
          ) : (
            <RawViewer content={content} onTextSelect={handleTextSelect} />
          )}
        </main>
        <aside className={styles.sidebar}>
          {showCommentForm && selectedAnchor ? (
            <CommentForm
              selectedText={selectedAnchor.selectedText}
              onSubmit={handleCommentSubmit}
              onCancel={handleCommentCancel}
            />
          ) : (
            <>
              {selectedAnchor && (
                <div className={styles.selectionActions}>
                  <div className={styles.selectedText}>
                    &quot;{selectedAnchor.selectedText.slice(0, 100)}
                    {selectedAnchor.selectedText.length > 100 ? '...' : ''}&quot;
                  </div>
                  <button
                    className={styles.addCommentButton}
                    onClick={handleAddCommentClick}
                  >
                    Add Comment
                  </button>
                </div>
              )}
              <CommentSidebar comments={comments} onCommentClick={handleCommentClick} />
            </>
          )}
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
