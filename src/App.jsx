import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { enablePushNotifications, notificationPermission, pushSupported, registerServiceWorker } from './lib/push'
import { loadMyProfile, signInWithUsername, signUpWithUsername } from './lib/auth'
import { cancelSurprise, loadSurprises, sendSurprise } from './lib/surprises'

const formatReminder = (value) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
const todayStr = () => new Date().toISOString().slice(0, 10)

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [message, setMessage] = useState('')
  const [view, setView] = useState('notes')
  const [notifyState, setNotifyState] = useState(pushSupported() ? notificationPermission() : 'unsupported')

  // Notes
  const [notes, setNotes] = useState([])
  const [showEditor, setShowEditor] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [reminderAt, setReminderAt] = useState('')

  // Surprises
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [surprise, setSurprise] = useState({ to: '', title: '', message: '', deliverOn: '' })
  const [isSending, setIsSending] = useState(false)

  // Auth form
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const upcomingNotes = useMemo(() => notes.filter((n) => n.reminder_at && new Date(n.reminder_at) > new Date()).sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at)), [notes])
  const todaysSurprises = useMemo(() => received.filter((s) => s.deliver_on === todayStr()), [received])
  const resetEditor = () => { setTitle(''); setContent(''); setReminderAt(''); setShowEditor(false) }

  const enableNotifications = async () => {
    try {
      await enablePushNotifications()
      setNotifyState('granted')
      setMessage('Reminders and surprises will now reach this device.')
      return true
    } catch (error) {
      setNotifyState(notificationPermission())
      setMessage(error.message || 'Could not turn on notifications.')
      return false
    }
  }

  useEffect(() => {
    if (pushSupported()) registerServiceWorker()
  }, [])

  // Self-heal push subscription when permission is already granted.
  useEffect(() => {
    if (!session || !pushSupported() || notificationPermission() !== 'granted') return undefined
    enablePushNotifications()
      .then(() => setNotifyState('granted'))
      .catch((err) => { setNotifyState(notificationPermission()); setMessage(err.message || '') })
    return undefined
  }, [session])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setIsLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setProfile(null); setNotes([]); setReceived([]); setSent([]); setIsLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Once signed in, load the profile, notes, and surprises.
  useEffect(() => {
    if (!session) return undefined
    let active = true
    const load = async () => {
      setIsLoading(true)
      const myProfile = await loadMyProfile()
      if (!active) return
      setProfile(myProfile)
      const [notesRes, surprisesRes] = await Promise.all([
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        loadSurprises(session.user.id).catch(() => ({ received: [], sent: [] })),
      ])
      if (!active) return
      if (notesRes.error) setMessage('Could not load your notes.')
      else setNotes(notesRes.data)
      setReceived(surprisesRes.received)
      setSent(surprisesRes.sent)
      setIsLoading(false)
    }
    load()
    return () => { active = false }
  }, [session])

  const handleAuth = async (event) => {
    event.preventDefault()
    setIsAuthenticating(true); setMessage('')
    try {
      if (authMode === 'signup') await signUpWithUsername(authForm.username, authForm.password)
      else await signInWithUsername(authForm.username, authForm.password)
      setAuthForm({ username: '', password: '' })
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) { setMessage('Write a title or a note before saving.'); return }
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('notes').insert({ title: title.trim() || 'Untitled note', content: content.trim(), reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null }).select().single()
      if (error) throw error
      setNotes((current) => [data, ...current]); resetEditor(); setMessage('Note saved.')
      if (reminderAt && pushSupported() && notifyState !== 'granted') await enableNotifications()
    } catch (error) { setMessage(error.message || 'Could not save the note.') } finally { setIsSaving(false) }
  }

  const deleteNote = async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) setMessage(error.message || 'Could not delete the note.')
    else { setNotes((current) => current.filter((n) => n.id !== id)); setMessage('Note deleted.') }
  }

  const sendSurpriseNote = async () => {
    setIsSending(true); setMessage('')
    try {
      await sendSurprise({
        recipientUsername: surprise.to,
        title: surprise.title,
        message: surprise.message,
        deliverOn: surprise.deliverOn,
        senderUsername: profile?.username,
        senderId: session.user.id,
      })
      const refreshed = await loadSurprises(session.user.id)
      setReceived(refreshed.received); setSent(refreshed.sent)
      setSurprise({ to: '', title: '', message: '', deliverOn: '' })
      setMessage(`Your surprise for @${surprise.to.trim().toLowerCase()} is scheduled for ${formatDate(surprise.deliverOn)}. 🎁`)
    } catch (error) { setMessage(error.message || 'Could not send the surprise.') } finally { setIsSending(false) }
  }

  const cancelSurpriseNote = async (id) => {
    try {
      await cancelSurprise(id)
      setSent((current) => current.filter((s) => s.id !== id))
      setMessage('Surprise cancelled.')
    } catch (error) { setMessage(error.message || 'Could not cancel.') }
  }

  if (!isSupabaseConfigured) {
    return <div className="setup-screen"><div className="setup-card"><span className="brand-mark">✦</span><h1>My Notes is ready for Supabase</h1><p>Finish the free database connection to turn on accounts and reminders.</p></div></div>
  }

  if (!session) {
    return (
      <div className="setup-screen">
        <form className="auth-card" onSubmit={handleAuth}>
          <span className="brand-mark">✦</span>
          <h1>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>{authMode === 'login' ? 'Sign in to your notes and surprises.' : 'Pick a username so friends can send you surprises.'}</p>
          <input placeholder="Username" autoCapitalize="none" autoCorrect="off" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} />
          <input type="password" placeholder="Password (at least 6 characters)" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
          {message && <p className="message">{message}</p>}
          <button className="save-button" disabled={isAuthenticating}>{isAuthenticating ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setMessage('') }}>
            {authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand"><span className="brand-mark">✦</span><div><h1>My Notes</h1><p>Notes, reminders & surprises.</p></div></div>
        <div className="header-actions">
          {notifyState !== 'unsupported' && (notifyState === 'granted'
            ? <button className="notify-status" onClick={enableNotifications} title="Notifications are on — click to re-check this device">🔔 On</button>
            : <button className="notify-button" onClick={enableNotifications}>🔔 Enable alerts</button>)}
          {profile && <span className="user-email">@{profile.username}</span>}
          <button className="signout-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'notes' ? 'tab active' : 'tab'} onClick={() => setView('notes')}>My Notes</button>
        <button className={view === 'surprises' ? 'tab active' : 'tab'} onClick={() => setView('surprises')}>
          Surprises{todaysSurprises.length > 0 ? ` 🎉` : ''}
        </button>
      </nav>

      <main className="content">
        {message && <p className="message" role="status">{message}</p>}

        {view === 'notes' && (
          <>
            <div className="section-head">
              <div><span className="eyebrow">YOUR PERSONAL NOTEBOOK</span><h2>Keep the little ideas.</h2></div>
              <button className="add-button" onClick={() => setShowEditor(true)}>+ New Note</button>
            </div>
            {upcomingNotes.length > 0 && <section className="reminder-strip"><span>⏰</span><p><strong>Next reminder:</strong> {upcomingNotes[0].title} — {formatReminder(upcomingNotes[0].reminder_at)}</p></section>}
            {showEditor && (
              <div className="editor">
                <input className="title-input" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className="content-input" placeholder="Start writing your note..." value={content} onChange={(e) => setContent(e.target.value)} />
                <label className="reminder-field">Remind me at <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} /></label>
                <div className="editor-buttons"><button className="cancel-button" onClick={resetEditor}>Cancel</button><button className="save-button" onClick={saveNote} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Note'}</button></div>
              </div>
            )}
            {isLoading && <div className="empty-state"><p>Loading…</p></div>}
            {!isLoading && !showEditor && notes.length === 0 && <div className="empty-state"><div className="note-icon">📝</div><h2>No notes yet</h2><p>Create your first note and start writing.</p><button className="start-button" onClick={() => setShowEditor(true)}>Create Your First Note</button></div>}
            {!isLoading && notes.length > 0 && (
              <div className="notes-grid">
                {notes.map((note) => (
                  <div className="note-card" key={note.id}>
                    <h3>{note.title}</h3><p>{note.content}</p>
                    <div className="note-footer">
                      <span>{note.reminder_at ? `⏰ ${formatReminder(note.reminder_at)}` : new Date(note.created_at).toLocaleDateString()}</span>
                      <button className="delete-button" onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'surprises' && (
          <>
            <div className="section-head"><div><span className="eyebrow">SURPRISE NOTES</span><h2>Send a note that arrives on the day. 🎂</h2></div></div>

            <div className="editor surprise-form">
              <label className="field-label">To (their username)</label>
              <input className="title-input" placeholder="@username" autoCapitalize="none" autoCorrect="off" value={surprise.to} onChange={(e) => setSurprise({ ...surprise, to: e.target.value })} />
              <label className="field-label">Title</label>
              <input className="title-input" placeholder="Happy Birthday! 🎉" value={surprise.title} onChange={(e) => setSurprise({ ...surprise, title: e.target.value })} />
              <label className="field-label">Message</label>
              <textarea className="content-input" placeholder="Write your surprise message..." value={surprise.message} onChange={(e) => setSurprise({ ...surprise, message: e.target.value })} />
              <label className="reminder-field">Deliver on <input type="date" min={todayStr()} value={surprise.deliverOn} onChange={(e) => setSurprise({ ...surprise, deliverOn: e.target.value })} /></label>
              <div className="editor-buttons"><button className="save-button" onClick={sendSurpriseNote} disabled={isSending}>{isSending ? 'Scheduling…' : 'Schedule Surprise 🎁'}</button></div>
            </div>

            <h3 className="list-title">Surprises for you</h3>
            {received.length === 0 && <p className="muted">No surprises have arrived yet. They appear here on the day they’re delivered.</p>}
            {received.length > 0 && (
              <div className="notes-grid">
                {received.map((s) => (
                  <div className={`note-card surprise-card${s.deliver_on === todayStr() ? ' today' : ''}`} key={s.id}>
                    <h3>{s.title || 'A surprise for you'}</h3><p>{s.message}</p>
                    <div className="note-footer"><span>From @{s.sender_username} · {formatDate(s.deliver_on)}</span></div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="list-title">Surprises you’ve scheduled</h3>
            {sent.length === 0 && <p className="muted">You haven’t scheduled any surprises yet.</p>}
            {sent.length > 0 && (
              <div className="notes-grid">
                {sent.map((s) => (
                  <div className="note-card" key={s.id}>
                    <h3>{s.title || 'Untitled surprise'}</h3><p>{s.message}</p>
                    <div className="note-footer">
                      <span>{s.delivered_at ? '✅ Delivered' : '⏳ Scheduled'} · {formatDate(s.deliver_on)}</span>
                      {!s.delivered_at && <button className="delete-button" onClick={() => cancelSurpriseNote(s.id)} aria-label="Cancel surprise">🗑️</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
