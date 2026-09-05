import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { enablePushNotifications, notificationPermission, pushSupported, registerServiceWorker } from './lib/push'
import { loadMyProfile, signInWithUsername, signUpWithUsername } from './lib/auth'
import { cancelSurprise, loadSurprises, sendSurprise } from './lib/surprises'
import { loadMessages, markConversationRead, sendMessage, subscribeToMessages } from './lib/messages'

const formatReminder = (value) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
const formatTime = (value) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const todayStr = () => new Date().toISOString().slice(0, 10)
const pad = (n) => String(n).padStart(2, '0')
// Breaks a millisecond gap into days/hours/minutes/seconds for the timer.
const countdownParts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

const CalendarIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
)
const TrashIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </svg>
)

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

  // Messages
  const [messages, setMessages] = useState([])
  const [activeConvo, setActiveConvo] = useState(null) // other user's id
  const [newConvo, setNewConvo] = useState('')
  const [draft, setDraft] = useState('')

  // Live tick (for surprise countdowns)
  const [now, setNow] = useState(() => Date.now())

  // Profile
  const [pwd, setPwd] = useState('')

  // Auth form
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const myId = session?.user?.id
  const upcomingNotes = useMemo(() => notes.filter((n) => n.reminder_at && new Date(n.reminder_at) > new Date()).sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at)), [notes])
  const todaysSurprises = useMemo(() => received.filter((s) => s.deliver_on === todayStr()), [received])

  // Group messages into conversations by the other person.
  const conversations = useMemo(() => {
    const map = new Map()
    for (const m of messages) {
      const other = m.sender_id === myId
        ? { id: m.recipient_id, username: m.recipient_username }
        : { id: m.sender_id, username: m.sender_username }
      const convo = map.get(other.id) || { ...other, last: null, unread: 0, messages: [] }
      convo.messages.push(m)
      convo.last = m
      if (m.recipient_id === myId && !m.read_at) convo.unread += 1
      map.set(other.id, convo)
    }
    return [...map.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at))
  }, [messages, myId])
  const totalUnread = useMemo(() => conversations.reduce((sum, c) => sum + c.unread, 0), [conversations])
  const activeThread = useMemo(() => conversations.find((c) => c.id === activeConvo) || null, [conversations, activeConvo])
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

  // Tick every second so countdown timers update live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
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
      if (!next) { setProfile(null); setNotes([]); setReceived([]); setSent([]); setMessages([]); setActiveConvo(null); setView('notes'); setIsLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Once signed in, load the profile, notes, surprises, and messages.
  useEffect(() => {
    if (!session) return undefined
    let active = true
    const load = async () => {
      setIsLoading(true)
      const myProfile = await loadMyProfile()
      if (!active) return
      setProfile(myProfile)
      const [notesRes, surprisesRes, msgs] = await Promise.all([
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        loadSurprises(session.user.id).catch(() => ({ received: [], sent: [] })),
        loadMessages().catch(() => []),
      ])
      if (!active) return
      if (notesRes.error) setMessage('Could not load your notes.')
      else setNotes(notesRes.data)
      setReceived(surprisesRes.received)
      setSent(surprisesRes.sent)
      setMessages(msgs)
      setIsLoading(false)
    }
    load()
    return () => { active = false }
  }, [session])

  // Live chat: refresh messages whenever a new one arrives for me.
  useEffect(() => {
    if (!myId) return undefined
    const unsubscribe = subscribeToMessages(myId, () => {
      loadMessages().then(setMessages).catch(() => {})
    })
    return unsubscribe
  }, [myId])

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

  const openConversation = async (otherId) => {
    setActiveConvo(otherId)
    setView('messages')
    await markConversationRead(otherId, myId)
    setMessages((current) => current.map((m) => (m.sender_id === otherId && m.recipient_id === myId && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)))
  }

  const startNewConversation = async (event) => {
    event.preventDefault()
    const name = newConvo.trim().toLowerCase()
    if (!name) return
    setDraft(''); setNewConvo(''); setMessage('')
    // Open a placeholder thread; it becomes real once the first message is sent.
    try {
      const sentMsg = await sendMessage({ recipientUsername: name, body: draft || '👋', senderUsername: profile?.username, senderId: myId })
      setMessages((current) => [...current, sentMsg])
      setActiveConvo(sentMsg.recipient_id)
    } catch (error) { setMessage(error.message || 'Could not start the conversation.') }
  }

  const sendChatMessage = async () => {
    if (!draft.trim() || !activeThread) return
    const body = draft.trim()
    setDraft('')
    try {
      const sentMsg = await sendMessage({ recipientUsername: activeThread.username, body, senderUsername: profile?.username, senderId: myId })
      setMessages((current) => [...current, sentMsg])
    } catch (error) { setMessage(error.message || 'Could not send.'); setDraft(body) }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (pwd.length < 6) { setMessage('Password must be at least 6 characters.'); return }
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setPwd('')
    setMessage(error ? (error.message || 'Could not change password.') : 'Password updated. ✅')
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
          {notifyState !== 'unsupported' && (
            <button
              className={`bell-toggle${notifyState === 'granted' ? ' on' : ''}`}
              onClick={enableNotifications}
              title={notifyState === 'granted' ? 'Notifications on' : 'Turn on notifications'}
              aria-label={notifyState === 'granted' ? 'Notifications on' : 'Turn on notifications'}
            >{notifyState === 'granted' ? '🔔' : '🔕'}</button>
          )}
          {profile && <button className="header-avatar" onClick={() => setView('profile')} title={`@${profile.username} — profile`}>{profile.username.slice(0, 1).toUpperCase()}</button>}
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'notes' ? 'tab active' : 'tab'} onClick={() => setView('notes')}>My Notes</button>
        <button className={view === 'surprises' ? 'tab active' : 'tab'} onClick={() => setView('surprises')}>
          Surprises{todaysSurprises.length > 0 ? ' 🎉' : ''}
        </button>
        <button className={view === 'messages' ? 'tab active' : 'tab'} onClick={() => { setView('messages'); setActiveConvo(null) }}>
          Messages{totalUnread > 0 ? <span className="badge">{totalUnread}</span> : ''}
        </button>
        <button className={view === 'profile' ? 'tab active' : 'tab'} onClick={() => setView('profile')}>Profile</button>
      </nav>

      <main className="content">
        {message && <p className="message" role="status">{message}</p>}

        {view === 'notes' && (
          <>
            <div className="urdu-hero">
              <span className="urdu-word" lang="ur" dir="rtl">میرے خط</span>
              <span className="urdu-caption">mere khat — my notes</span>
              <span className="hero-seal" aria-hidden="true"></span>
            </div>
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
                      <span className="date-label">{note.reminder_at ? <>⏰ {formatReminder(note.reminder_at)}</> : <><CalendarIcon /> {new Date(note.created_at).toLocaleDateString()}</>}</span>
                      <button className="delete-button" onClick={() => deleteNote(note.id)} aria-label={`Delete ${note.title}`}><TrashIcon /></button>
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
            {received.length === 0 && <p className="muted">No surprises yet. When a friend sends you one, you’ll see it counting down here.</p>}
            {received.length > 0 && (
              <div className="notes-grid">
                {received.map((s) => {
                  const remaining = new Date(`${s.deliver_on}T00:00:00`).getTime() - now
                  const unlocked = remaining <= 0
                  const t = countdownParts(remaining)
                  return (
                    <div className={`note-card countdown-card${unlocked ? ' unlocked' : ''}`} key={s.id}>
                      {unlocked ? (
                        <>
                          <div className="countdown-badge">🎉 From @{s.sender_username}</div>
                          <h3>{s.title || 'A surprise for you'}</h3>
                          <p>{s.message}</p>
                        </>
                      ) : (
                        <>
                          <div className="countdown-badge">🎁 @{s.sender_username} · Something is coming…</div>
                          <div className="countdown-timer">
                            <span>{pad(t.d)}</span>:<span>{pad(t.h)}</span>:<span>{pad(t.m)}</span>:<span>{pad(t.s)}</span>
                          </div>
                          <div className="countdown-labels"><span>days</span><span>hrs</span><span>min</span><span>sec</span></div>
                        </>
                      )}
                      <div className="note-footer"><span>{unlocked ? 'Unlocked' : 'Unlocks'} {formatDate(s.deliver_on)}</span></div>
                    </div>
                  )
                })}
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
                      {!s.delivered_at && <button className="delete-button" onClick={() => cancelSurpriseNote(s.id)} aria-label="Cancel surprise"><TrashIcon /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'messages' && !activeThread && (
          <>
            <div className="section-head"><div><span className="eyebrow">MESSAGES</span><h2>Chat with your friends. 💬</h2></div></div>
            <form className="editor surprise-form" onSubmit={startNewConversation}>
              <label className="field-label">Start a chat with (their username)</label>
              <div className="new-convo-row">
                <input className="title-input" placeholder="@username" autoCapitalize="none" autoCorrect="off" value={newConvo} onChange={(e) => setNewConvo(e.target.value)} />
                <button className="save-button" type="submit">Message</button>
              </div>
            </form>
            <h3 className="list-title">Conversations</h3>
            {conversations.length === 0 && <p className="muted">No conversations yet. Start one above.</p>}
            {conversations.map((c) => (
              <button className="convo-row" key={c.id} onClick={() => openConversation(c.id)}>
                <div className="convo-avatar">{c.username.slice(0, 1).toUpperCase()}</div>
                <div className="convo-main">
                  <div className="convo-top"><strong>@{c.username}</strong><span>{formatTime(c.last.created_at)}</span></div>
                  <div className="convo-preview">{c.last.sender_id === myId ? 'You: ' : ''}{c.last.body}</div>
                </div>
                {c.unread > 0 && <span className="badge">{c.unread}</span>}
              </button>
            ))}
          </>
        )}

        {view === 'profile' && (
          <>
            <div className="section-head"><div><span className="eyebrow">PROFILE</span><h2>Your account</h2></div></div>
            <div className="profile-card">
              <div className="profile-top">
                <div className="convo-avatar profile-avatar">{profile?.username?.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h3>@{profile?.username}</h3>
                  {profile?.created_at && <p className="muted">Member since {formatDate(profile.created_at.slice(0, 10))}</p>}
                </div>
              </div>
              <div className="profile-stats">
                <div><strong>{notes.length}</strong><span>Notes</span></div>
                <div><strong>{received.length}</strong><span>Surprises</span></div>
                <div><strong>{sent.length}</strong><span>Sent</span></div>
                <div><strong>{conversations.length}</strong><span>Chats</span></div>
              </div>
              <form className="profile-pass" onSubmit={changePassword}>
                <label className="field-label">Change password</label>
                <div className="new-convo-row">
                  <input type="password" className="pass-input" placeholder="New password (min 6 chars)" value={pwd} onChange={(e) => setPwd(e.target.value)} />
                  <button className="save-button" type="submit">Update</button>
                </div>
              </form>
              <button className="signout-button profile-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          </>
        )}

        {view === 'messages' && activeThread && (
          <div className="chat">
            <div className="chat-head">
              <button className="cancel-button" onClick={() => setActiveConvo(null)}>← Back</button>
              <strong>@{activeThread.username}</strong>
            </div>
            <div className="chat-thread">
              {activeThread.messages.map((m) => (
                <div className={m.sender_id === myId ? 'bubble mine' : 'bubble theirs'} key={m.id}>
                  <p>{m.body}</p>
                  <span className="bubble-time">{formatTime(m.created_at)}</span>
                </div>
              ))}
            </div>
            <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); sendChatMessage() }}>
              <input placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="save-button" type="submit" disabled={!draft.trim()}>Send</button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
