import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signInWithGoogle } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

function clearAuditCache() {
  try {
    sessionStorage.removeItem('atlas.mapData.v2')
    sessionStorage.removeItem('atlas.mapData.v1')
  } catch {}
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => { clearAuditCache() }, [])

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleSignIn = async () => {
    setAuthError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch {
      setAuthError('Sign-in cancelled or failed. Try again.')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f7f6f1]">
      <Blobs />

      {/* Split layout */}
      <div className="relative z-10 h-full w-full max-w-5xl mx-auto flex items-center px-12 gap-0">

        {/* Left — Mascot, takes 45% */}
        <div className="flex-1 flex items-center justify-center">
          <img
            src="/atlas-mascot.png"
            alt="Atlas mascot"
            className="w-[260px] object-contain select-none"
            style={{ filter: 'drop-shadow(0 16px 48px rgba(255,195,0,0.30))' }}
          />
        </div>

        {/* Right — Content, takes 55% */}
        <div className="flex flex-col items-start gap-5" style={{ flex: '0 0 52%' }}>

          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFC300]/10 border border-[#FFC300]/25 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFC300] shrink-0" />
            <span className="text-[10px] font-semibold text-[#9a7d00] tracking-wider uppercase">
              Made by UMBC Students · For UMBC Students
            </span>
          </span>

          {/* Wordmark */}
          <div>
            <h1 className="text-[76px] font-black leading-none tracking-[-0.04em] text-black select-none">
              Atlas
            </h1>
            <div className="h-[3px] w-14 bg-[#FFC300] rounded-full mt-2" />
          </div>

          {/* Tagline */}
          <p className="text-[15px] text-[#777] leading-snug">
            Your personal autopilot<br />
            <span className="text-black font-semibold">for your degree audit.</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-lg bg-black text-white text-[13px] font-semibold w-fit hover:bg-[#111] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.20)] hover:shadow-[0_8px_24px_rgba(255,195,0,0.18)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingIn ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              {signingIn ? 'Signing in…' : 'Get Started'}
            </button>
            {authError && <p className="text-xs text-red-500">{authError}</p>}
          </div>

          {/* Powered by */}
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] text-[#c0bdb5] uppercase tracking-widest font-medium">Powered by</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip label="Gemini Computer Use" />
              <Chip label="UMBC COEIT" />
              <Chip label="Playwright" />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom tagline */}
      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-[#c0bdb5] z-10 select-none italic whitespace-nowrap">
        For every COEIT student who opens their window and finds the seat already gone.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"/>
    </svg>
  )
}

function Chip({ label }) {
  return (
    <span className="text-[10px] text-[#999] bg-white/60 backdrop-blur-sm border border-[#e8e7e0] px-2.5 py-1 rounded-full">
      {label}
    </span>
  )
}

function Blobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-5%] left-[-5%] w-96 h-96 rounded-full bg-[#FFC300]/20 blur-[100px]" />
      <div className="absolute bottom-[10%] right-[-5%] w-80 h-80 rounded-full bg-[#FFC300]/15 blur-[90px]" />
      <div className="absolute top-[40%] left-[40%] w-64 h-64 rounded-full bg-[#FFC300]/10 blur-[80px]" />
      <div className="absolute rounded-full border border-[#FFC300]/20"
        style={{ width: 480, height: 480, top: '50%', left: '25%', transform: 'translate(-50%,-50%)' }} />
      <div className="absolute rounded-full border border-[#FFC300]/10"
        style={{ width: 700, height: 700, top: '50%', left: '25%', transform: 'translate(-50%,-50%)' }} />
    </div>
  )
}
