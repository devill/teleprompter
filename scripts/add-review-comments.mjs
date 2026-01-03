#!/usr/bin/env node

/**
 * Add review comments to an Autolektor document.
 *
 * Usage:
 *   node scripts/add-review-comments.mjs <document-path> <comments-json>
 *
 * Where comments-json is a JSON array of comments:
 *   [
 *     { "quotedText": "text to highlight", "comment": "Your feedback here" },
 *     ...
 *   ]
 *
 * Or pipe the comments via stdin:
 *   echo '[{"quotedText": "...", "comment": "..."}]' | node scripts/add-review-comments.mjs <document-path>
 *
 * Or use a file:
 *   node scripts/add-review-comments.mjs <document-path> --file comments.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { resolve } from 'path'

const AUTHOR = 'Atanáz AI'

function loadMeta(metaPath) {
  if (existsSync(metaPath)) {
    const content = readFileSync(metaPath, 'utf-8')
    return JSON.parse(content)
  }
  return { comments: [] }
}

function saveMeta(metaPath, meta) {
  writeFileSync(metaPath, JSON.stringify(meta, null, 2))
}

function findQuotedText(content, quotedText) {
  const index = content.indexOf(quotedText)
  if (index === -1) {
    // Try case-insensitive search
    const lowerContent = content.toLowerCase()
    const lowerQuoted = quotedText.toLowerCase()
    const ciIndex = lowerContent.indexOf(lowerQuoted)
    if (ciIndex !== -1) {
      return { start: ciIndex, end: ciIndex + quotedText.length }
    }
    return null
  }
  return { start: index, end: index + quotedText.length }
}

function insertMarker(content, start, end, commentId) {
  const before = content.slice(0, start)
  const selected = content.slice(start, end)
  const after = content.slice(end)
  return `${before}[[c:${commentId}]]${selected}[[/c]]${after}`
}

function hasExistingMarker(content, start, end) {
  // Check if this region is already inside a marker
  const beforeText = content.slice(0, start)
  const openMarkers = (beforeText.match(/\[\[c:[^\]]+\]\]/g) || []).length
  const closeMarkers = (beforeText.match(/\[\[\/c\]\]/g) || []).length
  return openMarkers > closeMarkers
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')

    if (process.stdin.isTTY) {
      resolve(null)
      return
    }

    process.stdin.on('readable', () => {
      let chunk
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk
      }
    })

    process.stdin.on('end', () => {
      resolve(data.trim() || null)
    })

    // Timeout if no stdin after 100ms
    setTimeout(() => {
      if (!data) resolve(null)
    }, 100)
  })
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: node add-review-comments.mjs <document-path> [comments-json]')
    console.error('       node add-review-comments.mjs <document-path> --file <comments-file>')
    console.error('')
    console.error('Comments format: [{ "quotedText": "...", "comment": "..." }, ...]')
    process.exit(1)
  }

  const docPath = resolve(args[0])
  let commentsJson = null

  // Parse arguments
  if (args[1] === '--file' && args[2]) {
    commentsJson = readFileSync(resolve(args[2]), 'utf-8')
  } else if (args[1]) {
    commentsJson = args[1]
  } else {
    commentsJson = await readStdin()
  }

  if (!commentsJson) {
    console.error('Error: No comments provided')
    console.error('Provide comments as JSON argument, via --file, or pipe through stdin')
    process.exit(1)
  }

  let comments
  try {
    comments = JSON.parse(commentsJson)
  } catch (e) {
    console.error('Error: Invalid JSON:', e.message)
    process.exit(1)
  }

  if (!Array.isArray(comments)) {
    console.error('Error: Comments must be a JSON array')
    process.exit(1)
  }

  // Load document
  if (!existsSync(docPath)) {
    console.error(`Error: Document not found: ${docPath}`)
    process.exit(1)
  }

  let content = readFileSync(docPath, 'utf-8')
  const metaPath = docPath + '.meta.json'
  const meta = loadMeta(metaPath)

  console.log(`Adding ${comments.length} comments to: ${docPath}`)

  // Process comments in reverse order of position to avoid offset issues
  const processedComments = comments
    .map(c => {
      const position = findQuotedText(content, c.quotedText)
      return { ...c, position }
    })
    .filter(c => {
      if (!c.position) {
        console.warn(`Warning: Could not find quoted text: "${c.quotedText.slice(0, 50)}..."`)
        return false
      }
      return true
    })
    .sort((a, b) => b.position.start - a.position.start) // Reverse order

  let addedCount = 0

  for (const comment of processedComments) {
    const { position, quotedText } = comment

    // Re-find position in current content (after previous insertions)
    const currentPosition = findQuotedText(content, quotedText)
    if (!currentPosition) {
      console.warn(`Warning: Lost position for: "${quotedText.slice(0, 50)}..."`)
      continue
    }

    // Skip if already has a marker
    if (hasExistingMarker(content, currentPosition.start, currentPosition.end)) {
      console.warn(`Warning: Text already has a comment marker: "${quotedText.slice(0, 50)}..."`)
      continue
    }

    const commentId = randomUUID()

    // Insert marker into content
    content = insertMarker(content, currentPosition.start, currentPosition.end, commentId)

    // Add to meta
    meta.comments.push({
      id: commentId,
      author: AUTHOR,
      text: comment.comment,
      createdAt: new Date().toISOString()
    })

    addedCount++
    console.log(`  + "${quotedText.slice(0, 40)}..." → "${comment.comment.slice(0, 40)}..."`)
  }

  // Save both files
  writeFileSync(docPath, content)
  saveMeta(metaPath, meta)

  console.log(`\nDone! Added ${addedCount} comments.`)
  console.log(`  Document: ${docPath}`)
  console.log(`  Metadata: ${metaPath}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
