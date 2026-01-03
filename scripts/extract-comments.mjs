#!/usr/bin/env node

import { google } from 'googleapis'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createServer } from 'http'
import { URL } from 'url'
import { exec } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

const CREDENTIALS_PATH = resolve(PROJECT_ROOT, 'client_secret_2718089965-s6smeb459o2qquoijodsmj6ju7882hdn.apps.googleusercontent.com.json')
const TOKEN_PATH = resolve(PROJECT_ROOT, 'token.json')
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'scripts', 'extracted-comments.json')

const REVIEWER_EMAIL = 'talos.atanaz@gmail.com'
const REVIEWER_NAME = 'Atanáz Tálos'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly'
]

function loadCredentials() {
  const content = readFileSync(CREDENTIALS_PATH, 'utf-8')
  return JSON.parse(content)
}

function loadToken() {
  if (existsSync(TOKEN_PATH)) {
    const content = readFileSync(TOKEN_PATH, 'utf-8')
    return JSON.parse(content)
  }
  return null
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2))
}

function openBrowser(url) {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} "${url}"`)
}

async function getAuthenticatedClient(credentials) {
  const { client_id, client_secret, redirect_uris } = credentials.installed

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3333/oauth2callback'
  )

  const existingToken = loadToken()
  if (existingToken) {
    oAuth2Client.setCredentials(existingToken)

    if (existingToken.expiry_date && existingToken.expiry_date < Date.now()) {
      console.log('Token expired, refreshing...')
      const { credentials: newCredentials } = await oAuth2Client.refreshAccessToken()
      saveToken(newCredentials)
      oAuth2Client.setCredentials(newCredentials)
    }

    return oAuth2Client
  }

  return new Promise((resolvePromise, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost:3333')

      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code')

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>')

          server.close()

          const { tokens } = await oAuth2Client.getToken(code)
          saveToken(tokens)
          oAuth2Client.setCredentials(tokens)
          resolvePromise(oAuth2Client)
        } else {
          res.writeHead(400)
          res.end('No code received')
          server.close()
          reject(new Error('No authorization code received'))
        }
      }
    })

    server.listen(3333, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      })

      console.log('\nOpening browser for authentication...')
      console.log('If the browser does not open, visit this URL:\n')
      console.log(authUrl)
      console.log()

      openBrowser(authUrl)
    })
  })
}

async function listFilesInFolder(drive, folderId) {
  const files = []
  let pageToken = null

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document'`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken
    })

    files.push(...response.data.files)
    pageToken = response.data.nextPageToken
  } while (pageToken)

  return files
}

async function getCommentsForFile(drive, fileId) {
  const comments = []
  let pageToken = null

  do {
    const response = await drive.comments.list({
      fileId,
      fields: 'nextPageToken, comments(id, content, author, quotedFileContent, resolved, createdTime, modifiedTime, replies)',
      pageSize: 100,
      pageToken,
      includeDeleted: false
    })

    comments.push(...response.data.comments)
    pageToken = response.data.nextPageToken
  } while (pageToken)

  return comments
}

function isFromReviewer(comment) {
  const author = comment.author
  if (!author) return false

  return author.emailAddress === REVIEWER_EMAIL ||
         author.displayName === REVIEWER_NAME ||
         author.displayName?.includes('Atanáz')
}

function formatComment(comment, documentName) {
  return {
    documentName,
    commentText: comment.content,
    quotedText: comment.quotedFileContent?.value || null,
    resolved: comment.resolved || false,
    createdAt: comment.createdTime,
    replies: (comment.replies || []).map(reply => ({
      author: reply.author?.displayName,
      content: reply.content,
      createdAt: reply.createdTime
    }))
  }
}

async function main() {
  const folderId = process.argv[2]

  if (!folderId) {
    console.error('Usage: node extract-comments.mjs <FOLDER_ID>')
    console.error('\nTo get the folder ID, open the folder in Google Drive and copy the ID from the URL:')
    console.error('https://drive.google.com/drive/folders/<FOLDER_ID>')
    process.exit(1)
  }

  console.log('Loading credentials...')
  const credentials = loadCredentials()

  console.log('Authenticating...')
  const auth = await getAuthenticatedClient(credentials)

  const drive = google.drive({ version: 'v3', auth })

  console.log(`\nListing documents in folder ${folderId}...`)
  const files = await listFilesInFolder(drive, folderId)
  console.log(`Found ${files.length} documents\n`)

  const allComments = []

  for (const file of files) {
    process.stdout.write(`Processing "${file.name}"... `)

    const comments = await getCommentsForFile(drive, file.id)
    const reviewerComments = comments.filter(isFromReviewer)

    console.log(`${reviewerComments.length} comments from ${REVIEWER_NAME}`)

    for (const comment of reviewerComments) {
      allComments.push(formatComment(comment, file.name))
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Total documents processed: ${files.length}`)
  console.log(`Total comments from ${REVIEWER_NAME}: ${allComments.length}`)

  writeFileSync(OUTPUT_PATH, JSON.stringify(allComments, null, 2))
  console.log(`\nComments saved to: ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
