'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [finalEmail, setFinalEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFinalLoading, setIsFinalLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [finalMessage, setFinalMessage] = useState('')
  const [position, setPosition] = useState(null)
  const [finalPosition, setFinalPosition] = useState(null)

  useEffect(() => {
    // Initialize animations and effects
    const initScrollAnimations = () => {
      const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      }, observerOptions)
      
      document.querySelectorAll('.feature-card').forEach(card => {
        card.classList.add('fade-in-on-scroll')
        observer.observe(card)
      })
      
      document.querySelectorAll('.features-title, .final-title').forEach(title => {
        title.classList.add('fade-in-on-scroll')
        observer.observe(title)
      })
    }

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

    initScrollAnimations()
    const cleanupNav = initNavbarEffects()
    
    return cleanupNav
  }, [])

  const handleSubmit = async (e, isFinal = false) => {
    e.preventDefault()
    const currentEmail = isFinal ? finalEmail : email
    const setCurrentLoading = isFinal ? setIsFinalLoading : setIsLoading
    const setCurrentMessage = isFinal ? setFinalMessage : setMessage
    const setCurrentPosition = isFinal ? setFinalPosition : setPosition
    
    setCurrentLoading(true)
    setCurrentMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: currentEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setCurrentPosition(data.position)
        setCurrentMessage('Successfully joined the waitlist!')
        if (isFinal) {
          setFinalEmail('')
        } else {
          setEmail('')
        }
      } else {
        setCurrentMessage(data.error || 'Something went wrong')
      }
    } catch (error) {
      setCurrentMessage('Network error. Please try again.')
    } finally {
      setCurrentLoading(false)
    }
  }

  return (
    <>
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-glow"></div>
            <img src="/logo.png" alt="Aurum Prop Firm" className="logo-image" />
            <div className="logo-text-container">
              <span className="logo-text">AURUM</span>
              <span className="logo-subtitle">PROP FIRM</span>
            </div>
          </div>
          <div className="nav-menu">
            <div className="nav-indicator"></div>
            <span className="nav-status">LAUNCHING SOON</span>
            <Link href="/login" className="ml-4 text-navy-primary hover:text-gold-solid transition-colors font-medium">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <img src="/ilia-bronskiy-YaUv7f4d0-U-unsplash.jpg" alt="Trading Background" className="hero-image" />
          <div className="hero-overlay"></div>
        </div>
        
        {/* Animated Background Elements */}
        <div className="floating-elements">
          <div className="floating-element" data-speed="0.5"></div>
          <div className="floating-element" data-speed="0.8"></div>
          <div className="floating-element" data-speed="0.3"></div>
          <div className="floating-element" data-speed="0.6"></div>
        </div>
        
        {/* Trading Chart Animation */}
        <div className="chart-container">
          <svg className="trading-chart" viewBox="0 0 400 200">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor:'#D4AF37', stopOpacity:0.8}} />
                <stop offset="100%" style={{stopColor:'#D4AF37', stopOpacity:0.1}} />
              </linearGradient>
            </defs>
            <path className="chart-line" d="M0,150 Q100,120 200,80 T400,60" stroke="#D4AF37" strokeWidth="3" fill="none"/>
            <path className="chart-fill" d="M0,150 Q100,120 200,80 T400,60 L400,200 L0,200 Z" fill="url(#chartGradient)"/>
          </svg>
        </div>
        
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge-text">REVOLUTIONARY AI TRADING</span>
            <div className="badge-pulse"></div>
          </div>
          
          <h1 className="hero-title">
            <span className="title-line">Discipline,</span>
            <span className="title-line title-emphasis">Enforced.</span>
          </h1>
          
          <p className="hero-subtitle">
            The world's first <span className="highlight">agentic prop firm</span> is coming. We've built a system that curbs fear and greed,
            forcing the habits of elite traders. Your only job is to choose a direction. <span className="highlight">We handle the rest.</span>
          </p>

          {position ? (
            <div className="success-state" id="successMessage">
              <div className="success-icon">✨</div>
              <h3>Thank you. You're on the list.</h3>
              <p>You're #{position} in line. Get ready for the future of trading.</p>
            </div>
          ) : (
            <form className="waitlist-form" onSubmit={(e) => handleSubmit(e, false)}>
              <div className="input-group">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address" 
                  required 
                />
                <button type="submit" className="cta-button" disabled={isLoading}>
                  <span className="button-text">{isLoading ? 'Joining...' : 'Join the Waitlist'}</span>
                  <div className="button-shine"></div>
                </button>
              </div>
              {message && (
                <div className={`error-message ${message ? 'show' : ''}`}>
                  {message}
                </div>
              )}
            </form>
          )}
          
          {/* Trust Indicators */}
          <div className="trust-indicators">
            <div className="trust-item">
              <span className="trust-number">$25K</span>
              <span className="trust-label">Max Funding</span>
            </div>
            <div className="trust-item">
              <span className="trust-number">1:6</span>
              <span className="trust-label">Risk Reward</span>
            </div>
            <div className="trust-item">
              <span className="trust-number">AI</span>
              <span className="trust-label">Powered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="features-title">A Framework for Profitability.</h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" />
                </svg>
              </div>
              <h3>AI-Powered Risk Management</h3>
              <p>Our multi-agentic system manages your trades. With a fixed Risk-to-Reward of 1:3 (Standard) or
                1:6 (Pro), we've eliminated the possibility of daily loss breaches. You trade with confidence.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" />
                  <path
                    d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h3>Simplified Execution</h3>
              <p>We trade Gold, Silver, and Oil. Your focus is singular: analyze the market and choose to Buy or
                Sell. Our system handles position sizing, stops, and targets.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Automated Growth</h3>
              <p>Our journaling agent helps you learn from every entry, turning data into discipline. Pass our
                2-step challenge and get funded with up to a $25k account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta">
        <div className="final-cta-container">
          <h2 className="final-title">Become the trader you were meant to be.</h2>

          {finalPosition ? (
            <div className="success-state" id="finalSuccessMessage">
              <h3>Thank you. You're on the list.</h3>
              <p>You're #{finalPosition} in line. Get ready for the future of trading.</p>
            </div>
          ) : (
            <form className="waitlist-form final-form" onSubmit={(e) => handleSubmit(e, true)}>
              <div className="input-group">
                <input 
                  type="email" 
                  value={finalEmail}
                  onChange={(e) => setFinalEmail(e.target.value)}
                  placeholder="Enter your email address" 
                  required 
                />
                <button type="submit" className="cta-button" disabled={isFinalLoading}>
                  {isFinalLoading ? 'Joining...' : 'Join the Waitlist'}
                </button>
              </div>
              {finalMessage && (
                <div className={`error-message ${finalMessage ? 'show' : ''}`}>
                  {finalMessage}
                </div>
              )}
            </form>
          )}
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