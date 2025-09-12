'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Add scroll effect for navbar
    const initNavbarEffects = () => {
      const nav = document.querySelector('.nav')
      
      const handleScroll = () => {
        if (window.scrollY > 100) {
          nav?.classList.add('scrolled')
        } else {
          nav?.classList.remove('scrolled')
        }
      }
      
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }

    const cleanupNav = initNavbarEffects()
    return cleanupNav
  }, [])

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const session = await getSession()
      if (session) {
        // Redirect based on user role
        if (session.user.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      }
    }
    checkSession()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid credentials. Please check your email and password.')
      } else {
        // Get the session to determine redirect
        const session = await getSession()
        if (session?.user?.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const getPasswordStrength = (password) => {
    if (password.length < 6) return { strength: 'weak', color: 'text-red-400' }
    if (password.length < 10) return { strength: 'medium', color: 'text-yellow-400' }
    return { strength: 'strong', color: 'text-green-400' }
  }

  return (
    <>
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-glow"></div>
            <Link href="/">
              <img src="/logo.png" alt="Aurum Prop Firm" className="logo-image" />
            </Link>
            <div className="logo-text-container">
              <span className="logo-text">AURUM</span>
              <span className="logo-subtitle">PROP FIRM</span>
            </div>
          </div>
          <div className="nav-menu">
            <div className="nav-indicator"></div>
            <span className="nav-status">CLIENT LOGIN</span>
          </div>
        </div>
      </nav>

      {/* Login Section */}
      <section className="login-section">
        <div className="login-background">
          <div className="login-overlay"></div>
        </div>
        
        {/* Animated Background Elements */}
        <div className="floating-elements">
          <div className="floating-element" data-speed="0.5"></div>
          <div className="floating-element" data-speed="0.8"></div>
          <div className="floating-element" data-speed="0.3"></div>
          <div className="floating-element" data-speed="0.6"></div>
        </div>

        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="login-badge">
                <span className="badge-text">SECURE ACCESS</span>
                <div className="badge-pulse"></div>
              </div>
              
              <h1 className="login-title">Welcome Back</h1>
              <p className="login-subtitle">
                Access your <span className="highlight">client area</span> and trading dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="label-icon">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Email Address
                </label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`form-input ${email && !validateEmail(email) ? 'input-error' : ''}`}
                    placeholder="Enter your email address"
                    required
                  />
                  {email && validateEmail(email) && (
                    <div className="input-success-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  )}
                </div>
                {email && !validateEmail(email) && (
                  <div className="input-error-message">Please enter a valid email address</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="label-icon">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                    <path d="M7 11V7A5 5 0 0 1 17 7V11" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Password
                </label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C7 20 2.73 16.39 1 12A18.45 18.45 0 0 1 5.06 5.06L17.94 17.94Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4C17 4 21.27 7.61 23 12A18.5 18.5 0 0 1 19.42 16.42" stroke="currentColor" strokeWidth="2"/>
                        <path d="M1 1L23 23" stroke="currentColor" strokeWidth="2"/>
                        <path d="M10.5 10.5A2 2 0 0 1 13.5 13.5" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    )}
                  </button>
                </div>
                {password && (
                  <div className={`password-strength ${getPasswordStrength(password).color}`}>
                    Password strength: {getPasswordStrength(password).strength}
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message show">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="error-icon">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !validateEmail(email) || password.length < 6}
                className="login-button"
              >
                <span className="button-text">
                  {isLoading ? 'Signing in...' : 'Access Client Area'}
                </span>
                <div className="button-shine"></div>
                {!isLoading && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="button-icon">
                    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </form>

            <div className="login-footer">
              <Link href="/" className="back-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to home
              </Link>
              
              <div className="login-help">
                <p className="help-text">For waitlist members and administrators</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p>&copy; 2025 Aurum Prop Firm. All Rights Reserved.</p>
          <div className="social-links">
            <a href="https://www.linkedin.com/company/aurum-prop-firm/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 8A6 6 0 0 1 22 14V21H18V14A2 2 0 0 0 14 14V21H10V9H14V11A6 6 0 0 1 16 8Z"
                  fill="currentColor" />
                <rect x="2" y="9" width="4" height="12" fill="currentColor" />
                <circle cx="4" cy="4" r="2" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
