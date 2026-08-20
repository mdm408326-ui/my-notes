import { useState } from 'react'
import { login } from '../api/auth'

function Login({ onSwitch, onAuthenticated }) {
  const [form, setForm] = useState({ email: '', password: '' })
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
    if (!form.email) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Enter a valid email'
    if (!form.password) next.password = 'Password is required'
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
      const user = await login(form)
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
        <h1>Welcome back</h1>
        <p>Sign in to continue to your account</p>
      </div>

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
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
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

      <div className="auth-row">
        <label className="remember">
          <input type="checkbox" name="remember" />
          <span>Remember me</span>
        </label>
        <a href="#" className="link">
          Forgot password?
        </a>
      </div>

      {serverError && <div className="auth-alert">{serverError}</div>}

      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="auth-alt">
        Don&apos;t have an account?{' '}
        <button type="button" className="link" onClick={onSwitch}>
          Sign up
        </button>
      </p>
    </form>
  )
}

export default Login
