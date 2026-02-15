# Teleprompter

A speech-synced teleprompter app for presenters and speakers. The text scrolls automatically as you speak, tracking your position word-by-word using the Web Speech API.

## Features

- **Speech-synced scrolling**: Automatically follows along as you speak
- **Voice commands**: Jump to specific text, navigate sections, control playback
- **Loop mode**: Practice a section repeatedly
- **My Scripts**: Create and manage scripts in the browser (IndexedDB)
- **Folder access**: Open markdown files from local folders (Chromium only)
- **Paste support**: Paste scripts from clipboard, converts rich text to markdown

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:7313 in your browser.

## Usage

1. Go to `/open` to browse your scripts or add a folder
2. Click "New Script" to create a new script, or paste content with Cmd/Ctrl+V
3. Click a script to open it in the teleprompter
4. Click the microphone button to start speech recognition
5. Speak naturally - the teleprompter follows your voice

### Voice Commands

- "please jump to [text]" - Jump to matching text
- "please jump back [N]" - Jump back N paragraphs
- "please jump forward [N]" - Jump forward N paragraphs
- "please jump to section start" - Jump to start of current section
- "please jump to previous/next section" - Navigate between sections

### Keyboard Shortcuts

- **↑/↓** - Navigate between sections
- **←/→** - Navigate between paragraphs
- **Space** - Toggle pause
- **Page Up/Down** - Scroll by page
- **Cmd/Ctrl+V** - Paste script

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Vitest for testing
- CSS Modules

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # Run ESLint
npm test           # Run tests
```
