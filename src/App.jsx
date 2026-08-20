import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [notes, setNotes] = useState([])
  const [showEditor, setShowEditor] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const response = await fetch('/api/notes')
        if (!response.ok) throw new Error('Could not load notes')
        setNotes(await response.json())
      } catch {
        setMessage('The notes server is not running yet. Start it with: npm run dev inside the server folder.')
      } finally {
        setIsLoading(false)
      }
    }

    loadNotes()
  }, [])

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) {
      setMessage('Write a title or a note before saving.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      const newNote = await response.json()
      if (!response.ok) throw new Error(newNote.error)

      setNotes((currentNotes) => [newNote, ...currentNotes])
      setTitle('')
      setContent('')
      setShowEditor(false)
      setMessage('Note saved — it will still be here after a refresh.')
    } catch (error) {
      setMessage(error.message || 'Could not save the note. Is the server running?')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteNote = async (id) => {
    try {
      const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete note')
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
      setMessage('Note deleted.')
    } catch (error) {
      setMessage(error.message || 'Could not delete the note.')
    }
  }

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <h1>My Notes</h1>
            <p>A calm place for your bright ideas.</p>
          </div>
        </div>

        <button
          className="add-button"
          onClick={() => setShowEditor(true)}
        >
          + New Note
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="content">

        <div className="welcome">
          <span className="eyebrow">YOUR PERSONAL NOTEBOOK</span>
          <h2>Keep the little ideas.<br />They become big ones.</h2>
          <p>Capture a thought in seconds, then come back to it whenever you need it.</p>
        </div>

        {message && <p className="message" role="status">{message}</p>}

        {/* NOTE EDITOR */}

        {showEditor && (
          <div className="editor">

            <input
              className="title-input"
              type="text"
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              className="content-input"
              placeholder="Start writing your note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <div className="editor-buttons">

              <button
                className="cancel-button"
                onClick={() => {
                  setShowEditor(false)
                  setTitle('')
                  setContent('')
                }}
              >
                Cancel
              </button>

              <button className="save-button" onClick={saveNote} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Note'}
              </button>

            </div>

          </div>
        )}

        {/* NOTES */}

        {isLoading && <div className="empty-state"><p>Opening your notebook…</p></div>}

        {!isLoading && !showEditor && notes.length === 0 && (
          <div className="empty-state">

            <div className="note-icon">📝</div>

            <h2>No notes yet</h2>

            <p>
              Create your first note and start writing.
            </p>

            <button
              className="start-button"
              onClick={() => setShowEditor(true)}
            >
              Create Your First Note
            </button>

          </div>
        )}

        {!isLoading && !showEditor && notes.length > 0 && (
          <div className="notes-grid">

            {notes.map((note) => (
              <div className="note-card" key={note.id}>

                <h3>{note.title}</h3>

                <p>{note.content}</p>

                <div className="note-footer">

                  <span>
                    {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>

                  <button
                    className="delete-button"
                    onClick={() => deleteNote(note.id)}
                  >
                    🗑️
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

      </main>

    </div>
  )
}

export default App
