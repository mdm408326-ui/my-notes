import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = process.env.PORT || 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.join(__dirname, 'data')
const notesFile = path.join(dataDirectory, 'notes.json')
// For testing only. In production, load this from an environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_TTL = '2h'

app.use(cors())
app.use(express.json())

// A tiny file-based database for notes. It is intentionally simple so it is
// easy to understand while you are learning; later this can be swapped for a
// cloud database when the website is deployed.
const readNotes = async () => {
  try {
    return JSON.parse(await readFile(notesFile, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const saveNotes = async (notes) => {
  await mkdir(dataDirectory, { recursive: true })
  await writeFile(notesFile, JSON.stringify(notes, null, 2), 'utf8')
}

// --- In-memory user store (resets when the server restarts) ---
const users = new Map() // email -> { id, name, email, passwordHash }
let nextId = 1

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email })

const signToken = (u) =>
  jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: TOKEN_TTL })

// --- Routes ---
app.get('/api/notes', async (_req, res) => {
  try {
    const notes = await readNotes()
    res.json(notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)))
  } catch {
    res.status(500).json({ error: 'Could not load notes' })
  }
})

app.post('/api/notes', async (req, res) => {
  const title = String(req.body?.title || '').trim()
  const content = String(req.body?.content || '').trim()

  if (!title && !content) {
    return res.status(400).json({ error: 'Please write a title or note first' })
  }

  try {
    const notes = await readNotes()
    const now = new Date().toISOString()
    const note = {
      id: crypto.randomUUID(),
      title: title || 'Untitled note',
      content,
      createdAt: now,
      updatedAt: now,
    }
    notes.push(note)
    await saveNotes(notes)
    res.status(201).json(note)
  } catch {
    res.status(500).json({ error: 'Could not save note' })
  }
})

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const notes = await readNotes()
    const remainingNotes = notes.filter((note) => note.id !== req.params.id)
    if (remainingNotes.length === notes.length) {
      return res.status(404).json({ error: 'Note not found' })
    }
    await saveNotes(remainingNotes)
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Could not delete note' })
  }
})

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body || {}

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const key = email.toLowerCase()
  if (users.has(key)) {
    return res.status(409).json({ error: 'An account with this email already exists' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = { id: nextId++, name, email: key, passwordHash }
  users.set(key, user)

  return res.status(201).json({ token: signToken(user), user: publicUser(user) })
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = users.get(email.toLowerCase())
  // Same generic message whether the email or the password is wrong.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  return res.json({ token: signToken(user), user: publicUser(user) })
})

// Example protected route — returns the current user from the Bearer token.
app.get('/api/me', (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = users.get(payload.email)
    if (!user) return res.status(401).json({ error: 'User no longer exists' })
    return res.json({ user: publicUser(user) })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
})

// When deployed, Express serves the finished React website and the notes API
// from the same public address.
const clientBuild = path.join(__dirname, '..', 'dist')
app.use(express.static(clientBuild))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Notes API running on http://localhost:${PORT}`)
})
