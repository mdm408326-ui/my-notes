import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { enablePushNotifications, notificationPermission, pushSupported, registerServiceWorker } from './lib/push'

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
  const [notifyState, setNotifyState] = useState(pushSupported() ? notificationPermission() : 'unsupported')

  const upcomingNotes = useMemo(() => notes.filter((note) => note.reminder_at && new Date(note.reminder_at) > new Date()).sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at)), [notes])
  const resetEditor = () => { setTitle(''); setContent(''); setReminderAt(''); setShowEditor(false) }

  // Turn on phone notifications: asks permission and saves this device's push
  // subscription. Returns whether reminders can now reach this device.
  const enableNotifications = async () => {
    try {
      await enablePushNotifications()
      setNotifyState('granted')
      setMessage('Reminders are on for this device.')
      return true
    } catch (error) {
      setNotifyState(notificationPermission())
      setMessage(error.message || 'Could not turn on notifications.')
      return false
    }
  }

  useEffect(() => {
    // Register the service worker that will display reminder pushes.
    if (pushSupported()) registerServiceWorker()
  }, [])

  // Self-heal: if this browser already granted permission but the device's push
  // subscription isn't saved yet (e.g. an earlier attempt failed), save it now.
  useEffect(() => {
    if (!session || !pushSupported()) return undefined
    if (notificationPermission() !== 'granted') return undefined
    enablePushNotifications()
      .then(() => setNotifyState('granted'))
      .catch((err) => {
        setNotifyState(notificationPermission())
        setMessage(err.message || 'Could not finish turning on reminders.')
      })
    return undefined
  }, [session])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    // No sign-in screen: open (or silently create) an anonymous session so
    // every visitor gets a private notebook stored in the cloud database.
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) { setSession(data.session); return }
      const { error } = await supabase.auth.signInAnonymously()
      if (error) { setMessage('Could not open your notebook. Please refresh the page.'); setIsLoading(false) }
    }
    loadSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) { setNotes([]); setIsLoading(false) }
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

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) { setMessage('Write a title or a note before saving.'); return }
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('notes').insert({ title: title.trim() || 'Untitled note', content: content.trim(), reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null }).select().single()
      if (error) throw error
      setNotes((currentNotes) => [data, ...currentNotes]); resetEditor(); setMessage('Note saved safely in your online notebook.')
      // If they set a reminder but haven't turned on notifications yet, ask now.
      if (reminderAt && pushSupported() && notifyState !== 'granted') { await enableNotifications() }
    } catch (error) { setMessage(error.message || 'Could not save the note.') } finally { setIsSaving(false) }
  }

  const deleteNote = async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) setMessage(error.message || 'Could not delete the note.')
    else { setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id)); setMessage('Note deleted.') }
  }

  if (!isSupabaseConfigured) return <div className="setup-screen"><div className="setup-card"><span className="brand-mark">✦</span><h1>My Notes is ready for Supabase</h1><p>Finish the free database connection to turn on private accounts and reminders.</p></div></div>

  if (!session) return <div className="setup-screen"><div className="setup-card"><span className="brand-mark">✦</span><h1>My Notes</h1><p>{message || 'Opening your notebook…'}</p></div></div>

  return <div className="app"><header className="header"><div className="brand"><span className="brand-mark">✦</span><div><h1>My Notes</h1><p>A calm place for your bright ideas.</p></div></div><div className="header-actions">{notifyState !== 'unsupported' && (notifyState === 'granted' ? <button className="notify-status" onClick={enableNotifications} title="Reminders are on — click to re-check this device">🔔 Reminders on</button> : <button className="notify-button" onClick={enableNotifications}>🔔 Enable reminders</button>)}<button className="add-button" onClick={() => setShowEditor(true)}>+ New Note</button></div></header><main className="content"><div className="welcome"><span className="eyebrow">YOUR PERSONAL NOTEBOOK</span><h2>Keep the little ideas.<br />They become big ones.</h2><p>Capture a thought, plan a reminder, and return to it whenever you need it.</p></div>{message && <p className="message" role="status">{message}</p>}{upcomingNotes.length > 0 && <section className="reminder-strip"><span>⏰</span><p><strong>Next reminder:</strong> {upcomingNotes[0].title} — {formatReminder(upcomingNotes[0].reminder_at)}</p></section>}{showEditor && <div className="editor"><input className="title-input" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)} /><textarea className="content-input" placeholder="Start writing your note..." value={content} onChange={(e) => setContent(e.target.value)} /><label className="reminder-field">Remind me at <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} /></label><div className="editor-buttons"><button className="cancel-button" onClick={resetEditor}>Cancel</button><button className="save-button" onClick={saveNote} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Note'}</button></div></div>}{isLoading && <div className="empty-state"><p>Opening your notebook…</p></div>}{!isLoading && !showEditor && notes.length === 0 && <div className="empty-state"><div className="note-icon">📝</div><h2>No notes yet</h2><p>Create your first note and start writing.</p><button className="start-button" onClick={() => setShowEditor(true)}>Create Your First Note</button></div>}{!isLoading && !showEditor && notes.length > 0 && <div className="notes-grid">{notes.map((note) => <div className="note-card" key={note.id}><h3>{note.title}</h3><p>{note.content}</p><div className="note-footer"><span>{note.reminder_at ? `⏰ ${formatReminder(note.reminder_at)}` : new Date(note.created_at).toLocaleDateString()}</span><button className="delete-button" onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`}>🗑️</button></div></div>)}</div>}</main></div>
}

export default App
