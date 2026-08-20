import { useState } from 'react'
import { signup } from '../api/auth'

function Signup({ onSwitch, onAuthenticated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setServerError('')
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.email) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Enter a valid email'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 8)
      next.password = 'Use at least 8 characters'
    if (form.confirm !== form.password)
      next.confirm = 'Passwords do not match'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setServerError('')
    try {
      const user = await signup({
        name: form.name,
        email: form.email,
        password: form.password,
      })
      onAuthenticated?.(user)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div className="auth-head">
        <h1>Create account</h1>
        <p>Start your journey with us today</p>
      </div>

      <label className="field">
        <span>Full name</span>
        <input
          type="text"
          name="name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          className={errors.name ? 'invalid' : ''}
        />
        {errors.name && <small className="error">{errors.name}</small>}
      </label>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          className={errors.email ? 'invalid' : ''}
        />
        {errors.email && <small className="error">{errors.email}</small>}
      </label>

      <label className="field">
        <span>Password</span>
        <div className="password-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            className={errors.password ? 'invalid' : ''}
          />
          <button
            type="button"
            className="toggle-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && <small className="error">{errors.password}</small>}
      </label>

      <label className="field">
        <span>Confirm password</span>
        <input
          type={showPassword ? 'text' : 'password'}
          name="confirm"
          placeholder="Re-enter your password"
          value={form.confirm}
          onChange={handleChange}
          autoComplete="new-password"
          className={errors.confirm ? 'invalid' : ''}
        />
        {errors.confirm && <small className="error">{errors.confirm}</small>}
      </label>

      {serverError && <div className="auth-alert">{serverError}</div>}

      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="auth-alt">
        Already have an account?{' '}
        <button type="button" className="link" onClick={onSwitch}>
          Sign in
        </button>
      </p>
    </form>
  )
}

export default Signup
