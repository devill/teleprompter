# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Teleprompter is a speech-synced teleprompter app for presenters and speakers.

Design principle: **simplicity, ease of use and extensibility**

### Storage Architecture
- **My Scripts**: IndexedDB-backed storage for user scripts (full CRUD)
- **File System Folders**: Read-only access via File System Access API (Chromium only)
- **Session state**: localStorage for position, loop mode, listening state per script

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
- `/open` - Script browser with source list and file picker
- `/teleprompter?id=...` - Main teleprompter with speech-synced scrolling (id is script ID like `my-scripts:uuid` or `fs:sourceId:filename.md`)

### Code Organization
- `app/lib/` - Pure functions with tests (speechMatcher, textNormalizer, sectionParser)
- `app/lib/storage/` - Storage layer (IndexedDB, File System Access API, source registry)
- `app/hooks/` - React hooks for state and behavior
- `app/components/` - Reusable UI components
- `app/components/teleprompter/` - Teleprompter-specific components
- `app/components/open/` - Script browser components

### Key Systems

**Teleprompter Speech Matching**: Uses Web Speech API. The `speechMatcher` tracks position word-by-word with fuzzy matching. Jump commands use trigger phrase "please jump to" followed by target text.

**Storage Layer**: `sourceRegistry` manages multiple storage sources. `myScriptsSource` provides IndexedDB CRUD. `FileSystemSource` wraps File System Access API for read-only folder access.
