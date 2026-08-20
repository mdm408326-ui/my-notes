import { useState } from 'react'

const STARTER_NOTES = [
  { id: 1, title: 'Welcome to Nimbus', body: 'This is your space. Jot anything down.', tag: 'Getting started' },
  { id: 2, title: 'Groceries', body: 'Coffee, oat milk, bananas, bread.', tag: 'Personal' },
  { id: 3, title: 'Q3 planning', body: 'Draft the roadmap and share with the team.', tag: 'Work' },
]

function Home({ user, onLogout }) {
  const [notes, setNotes] = useState(STARTER_NOTES)
  const [draft, setDraft] = useState('')

  const addNote = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const [title, ...rest] = text.split('\n')
    setNotes((prev) => [
      { id: Date.now(), title, body: rest.join('\n'), tag: 'New' },
      ...prev,
    ])
    setDraft('')
  }

  const removeNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id))

  const firstName = user.name.split(' ')[0]

  return (
    <div className="home">
      <header className="home-nav">
        <div className="brand">
          <span className="brand-mark">◈</span> Nimbus
        </div>
        <div className="home-user">
          <span className="avatar">{firstName[0]?.toUpperCase()}</span>
          <span className="home-email">{user.email}</span>
          <button className="ghost-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="hero-band">
          <h1>Good to see you, {firstName}.</h1>
          <p>You have {notes.length} notes. Capture a new thought below.</p>
        </section>

        <section className="stats">
          <div className="stat">
            <span className="stat-num">{notes.length}</span>
            <span className="stat-label">Total notes</span>
          </div>
          <div className="stat">
            <span className="stat-num">
              {new Set(notes.map((n) => n.tag)).size}
            </span>
            <span className="stat-label">Tags</span>
          </div>
          <div className="stat">
            <span className="stat-num">∞</span>
            <span className="stat-label">Storage left</span>
          </div>
        </section>

        <form className="composer" onSubmit={addNote}>
          <textarea
            placeholder="Write a note… (first line becomes the title)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          <button type="submit" className="add-btn">
            Add note
          </button>
        </form>

        <section className="note-grid">
          {notes.map((note) => (
            <article className="note" key={note.id}>
              <span className="note-tag">{note.tag}</span>
              <h3>{note.title}</h3>
              {note.body && <p>{note.body}</p>}
              <button
                className="note-del"
                onClick={() => removeNote(note.id)}
                aria-label="Delete note"
              >
                ×
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default Home
