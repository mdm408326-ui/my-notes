import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const formatReminder = (value) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function App() {
  const [notes, setNotes] = useState([])
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [showEditor, setShowEditor] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const upcomingNotes = useMemo(() => notes.filter((note) => note.reminder_at && new Date(note.reminder_at) > new Date()).sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at)), [notes])
  const resetEditor = () => { setTitle(''); setContent(''); setReminderAt(''); setShowEditor(false) }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    const loadSession = async () => { const { data } = await supabase.auth.getSession(); setSession(data.session); setIsLoading(false) }
    loadSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setNotes([])
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const loadNotes = async () => {
      setIsLoading(true)
      const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (error) setMessage('Could not load your notes. Please try again.')
      else setNotes(data)
      setIsLoading(false)
    }
    loadNotes()
    return undefined
  }, [session])

  const handleAuth = async (event) => {
    event.preventDefault()
    if (!authForm.email || !authForm.password || (authMode === 'signup' && !authForm.name.trim())) { setMessage('Please complete all the fields.'); return }
    setIsAuthenticating(true); setMessage('')
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password, options: { data: { name: authForm.name.trim() } } })
        if (error) throw error
        setMessage(data.session ? 'Welcome! Your account is ready.' : 'Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
        if (error) throw error
      }
    } catch (error) { setMessage(error.message || 'Could not sign in. Please try again.') } finally { setIsAuthenticating(false) }
  }

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) { setMessage('Write a title or a note before saving.'); return }
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('notes').insert({ title: title.trim() || 'Untitled note', content: content.trim(), reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null }).select().single()
      if (error) throw error
      setNotes((currentNotes) => [data, ...currentNotes]); resetEditor(); setMessage('Note saved safely in your online notebook.')
    } catch (error) { setMessage(error.message || 'Could not save the note.') } finally { setIsSaving(false) }
  }

  const deleteNote = async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) setMessage(error.message || 'Could not delete the note.')
    else { setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id)); setMessage('Note deleted.') }
  }

  if (!isSupabaseConfigured) return <div className="setup-screen"><div className="setup-card"><span className="brand-mark">✦</span><h1>My Notes is ready for Supabase</h1><p>Finish the free database connection to turn on private accounts and reminders.</p></div></div>

  if (!session) return <div className="setup-screen"><form className="auth-card" onSubmit={handleAuth}><span className="brand-mark">✦</span><h1>{authMode === 'login' ? 'Welcome back' : 'Create your notebook'}</h1><p>{authMode === 'login' ? 'Sign in to see your private notes.' : 'Your notes will belong only to you.'}</p>{authMode === 'signup' && <input placeholder="Your name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} />}<input type="email" placeholder="Email address" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /><input type="password" placeholder="Password (at least 6 characters)" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />{message && <p className="message">{message}</p>}<button className="save-button" disabled={isAuthenticating}>{isAuthenticating ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button><button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setMessage('') }}>{authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></form></div>

  return <div className="app"><header className="header"><div className="brand"><span className="brand-mark">✦</span><div><h1>My Notes</h1><p>A calm place for your bright ideas.</p></div></div><div className="header-actions"><span className="user-email">{session.user.email}</span><button className="add-button" onClick={() => setShowEditor(true)}>+ New Note</button><button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button></div></header><main className="content"><div className="welcome"><span className="eyebrow">YOUR PERSONAL NOTEBOOK</span><h2>Keep the little ideas.<br />They become big ones.</h2><p>Capture a thought, plan a reminder, and return to it whenever you need it.</p></div>{message && <p className="message" role="status">{message}</p>}{upcomingNotes.length > 0 && <section className="reminder-strip"><span>⏰</span><p><strong>Next reminder:</strong> {upcomingNotes[0].title} — {formatReminder(upcomingNotes[0].reminder_at)}</p></section>}{showEditor && <div className="editor"><input className="title-input" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} /><textarea className="content-input" placeholder="Start writing your note..." value={content} onChange={(e) => setContent(e.target.value)} /><label className="reminder-field">Remind me at <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} /></label><div className="editor-buttons"><button className="cancel-button" onClick={resetEditor}>Cancel</button><button className="save-button" onClick={saveNote} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Note'}</button></div></div>}{isLoading && <div className="empty-state"><p>Opening your notebook…</p></div>}{!isLoading && !showEditor && notes.length === 0 && <div className="empty-state"><div className="note-icon">📝</div><h2>No notes yet</h2><p>Create your first note and start writing.</p><button className="start-button" onClick={() => setShowEditor(true)}>Create Your First Note</button></div>}{!isLoading && !showEditor && notes.length > 0 && <div className="notes-grid">{notes.map((note) => <div className="note-card" key={note.id}><h3>{note.title}</h3><p>{note.content}</p><div className="note-footer"><span>{note.reminder_at ? `⏰ ${formatReminder(note.reminder_at)}` : new Date(note.created_at).toLocaleDateString()}</span><button className="delete-button" onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`}>🗑️</button></div></div>)}</div>}</main></div>
}

export default App
