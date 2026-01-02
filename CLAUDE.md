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
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript (strict mode)
- ESLint with Next.js core-web-vitals and TypeScript rules

## Project Structure

```
app/           # Next.js App Router pages and layouts
public/        # Static assets
```

## Path Aliases

`@/*` maps to project root (configured in tsconfig.json)
