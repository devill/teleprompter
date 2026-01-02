'use client';

import styles from './ViewToggle.module.css';

type ViewType = 'rendered' | 'raw';

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${view === 'rendered' ? styles.active : ''}`}
        onClick={() => onViewChange('rendered')}
      >
        Rendered
      </button>
      <button
        className={`${styles.button} ${view === 'raw' ? styles.active : ''}`}
        onClick={() => onViewChange('raw')}
      >
        Raw
      </button>
    </div>
  );
}
