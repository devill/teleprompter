# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Autolektor is a text editor for writers that supports their work through:
- Mistake detection and proofreading
- Improvement suggestions
- Writing lifecycle management

Design principle: **simplicity, ease of use and extensibility**

### Storage Architecture
- **Git repository**: Primary content storage
- **Local storage**: Tracks recent changes
- **File structure per writing**:
  - `*.md` - Raw text content (markdown)
  - `*.meta.json` - Lifecycle info and comments (from humans and AI collaborators)

## Commands

```bash
npm run dev        # Start development server (http://localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm test           # Run tests once
npm run test:watch # Run tests in watch mode
```

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript (strict mode)
- Vitest for testing
- CSS Modules (no Tailwind)

## Path Aliases

`@/*` maps to project root (configured in tsconfig.json)

## Architecture

### Routes
- `/` - Home/landing page
- `/open` - File picker, redirects to edit with selected file path
- `/edit?path=...` - Main editor with markdown/raw view toggle and comment sidebar
- `/teleprompter?path=...` - Fullscreen teleprompter with speech-synced scrolling

### API Routes
- `GET/PUT /api/file?path=...` - Read/write markdown file content
- `GET/POST /api/meta?path=...` - Read/write `.meta.json` sidecar files (comments)

### Code Organization
- `app/lib/` - Pure functions with tests (markerParser, speechMatcher, textNormalizer, sectionParser)
- `app/hooks/` - React hooks for state and behavior
- `app/components/` - Reusable UI components
- `app/components/teleprompter/` - Teleprompter-specific components

### Key Systems

**Comment Markers**: Comments are stored in `.meta.json` but anchored in the markdown using inline markers `{{comment:uuid}}`. The `markerParser` handles stripping markers for display and injecting them for storage.

**Teleprompter Speech Matching**: Uses Web Speech API. The `speechMatcher` tracks position word-by-word with fuzzy matching. Jump commands use trigger phrase "please jump to" followed by target text.
