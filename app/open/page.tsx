"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function OpenPage() {
  const [filePath, setFilePath] = useState("");
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filePath.trim()) {
      router.push(`/edit?path=${encodeURIComponent(filePath.trim())}`);
    }
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="filePath">
          Enter file path
        </label>
        <input
          id="filePath"
          type="text"
          className={styles.input}
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="/path/to/your/file.md"
          autoFocus
        />
        <button type="submit" className={styles.button}>
          Open
        </button>
      </form>
    </div>
  );
}
