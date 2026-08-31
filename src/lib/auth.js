// Username + password accounts, built on Supabase's email auth.
// There is no real email: we map a username to a fixed internal address
// (username@mynotes.app). No mail is ever sent (email confirmation is off),
// so the address is just a stable internal id — friends only ever see the username.
import { supabase } from './supabase'

const EMAIL_DOMAIN = 'mynotes.app'
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export const normalizeUsername = (username) => (username || '').trim().toLowerCase()
const toEmail = (username) => `${normalizeUsername(username)}@${EMAIL_DOMAIN}`

export function validateUsername(username) {
  if (!USERNAME_RE.test(normalizeUsername(username))) {
    throw new Error('Username must be 3–20 characters: letters, numbers, or underscores.')
  }
}

export async function signUpWithUsername(username, password) {
  const clean = normalizeUsername(username)
  validateUsername(clean)
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.')

  const { data, error } = await supabase.auth.signUp({ email: toEmail(clean), password })
  if (error) {
    if (/registered|already/i.test(error.message)) throw new Error('That username is already taken.')
    throw new Error(error.message)
  }
  if (!data.session) {
    // Happens only if email confirmation is still ON in the Supabase dashboard.
    throw new Error('Account created, but sign-in is blocked. Turn off "Confirm email" in Supabase → Authentication.')
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, username: clean })
  if (profileError) {
    if (/duplicate|unique/i.test(profileError.message)) throw new Error('That username is already taken.')
    throw new Error('Could not finish setting up your account. Please try again.')
  }
  return data
}

export async function signInWithUsername(username, password) {
  validateUsername(username)
  const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password })
  if (error) throw new Error('Wrong username or password.')
}

// Loads the signed-in user's profile row (their username).
export async function loadMyProfile() {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return null
  const { data, error } = await supabase.from('profiles').select('id, username').eq('id', uid).maybeSingle()
  if (error) return null
  return data
}
