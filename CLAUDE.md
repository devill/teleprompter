# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Teleprompter is a speech-synced teleprompter app for presenters and speakers.

Design principle: **simplicity, ease of use and extensibility**

### Storage Architecture
- **Git repository**: Primary content storage
- **Local storage**: Tracks recent changes
- **File structure**: `*.md` - Raw text content (markdown)

## Commands

```bash
npm run dev        # Start development server (http://localhost:7313)
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
- `/` - Redirects to /open
- `/open` - File picker, redirects to teleprompter with selected file path
- `/teleprompter?path=...` - Main teleprompter with speech-synced scrolling

### API Routes
- `GET/PUT /api/file?path=...` - Read/write markdown file content

### Code Organization
- `app/lib/` - Pure functions with tests (speechMatcher, textNormalizer, sectionParser)
- `app/hooks/` - React hooks for state and behavior
- `app/components/` - Reusable UI components
- `app/components/teleprompter/` - Teleprompter-specific components

### Key Systems

**Teleprompter Speech Matching**: Uses Web Speech API. The `speechMatcher` tracks position word-by-word with fuzzy matching. Jump commands use trigger phrase "please jump to" followed by target text.

**Transcript Recording**: In record mode, the transcript file captures only what the user actually said - matched words and voice commands. Automatic behaviors (like loop mode jumps) must NOT be recorded since the user didn't speak them.
