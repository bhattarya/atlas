import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const MAP_CACHE_KEY = 'atlas.mapData.v2'

// Wipe any lingering audit cache — both the current key AND any older-version
// keys a returning user might still have in their session from a previous
// build. Landing = always fresh.
function clearAuditCache() {
  try {
    sessionStorage.removeItem(MAP_CACHE_KEY)
    sessionStorage.removeItem('atlas.mapData.v1')
  } catch {}
}

export default function LandingPage() {
  const navigate = useNavigate()

  // Hitting the landing page at all — whether via click, back button, or
  // typing the URL — resets the session so the next /dashboard visit shows
  // the upload screen. (Firebase auth would do this automatically per user,
  // but we don't need that yet.)
  useEffect(() => {
    clearAuditCache()
  }, [])

  const handleGetStarted = () => {
    clearAuditCache()
    navigate('/dashboard')
  }

  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-[#f7f6f1]">
      <Blobs />

      {/* Giant watermark logo behind the title — ties brand mark to wordmark */}
      <img
        src="/atlas-logo.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[58%] w-[560px] opacity-[0.06] z-0"
      />

      <div className="relative z-10 flex flex-col items-center text-center gap-5 px-6 max-w-xl">
        {/* Crisp foreground logo */}
        <img
          src="/atlas-logo.svg"
          alt="Atlas"
          className="w-24 h-24 drop-shadow-[0_8px_24px_rgba(255,195,0,0.35)] mb-1"
        />

        {/* Wordmark — serif display, tight tracking, subtle gold underscore */}
        <div className="flex flex-col items-center gap-2">
          <h1
            className="font-display font-black text-[88px] leading-none tracking-[-0.04em] text-black select-none"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            Atlas
          </h1>
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-[#FFC300]" />
            <span className="font-mascot text-[11px] tracking-[0.42em] text-[#8a7a3a]">
              UMBC · COEIT · REGISTRATION CO-PILOT
            </span>
            <span className="h-px w-6 bg-[#FFC300]" />
          </div>
        </div>

        <p className="text-[15px] text-[#666] leading-relaxed max-w-sm mt-1">
          Class standing decides who gets to plan.<br />
          <span className="text-black font-medium">Atlas decides who gets to win.</span>
        </p>

        <div className="mt-2">
          <button
            onClick={handleGetStarted}
            className="group px-8 py-2.5 rounded-full bg-black text-[#FFC300] text-sm font-semibold hover:bg-[#111] transition-all shadow-[0_6px_20px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_28px_rgba(255,195,0,0.25)] hover:-translate-y-px"
          >
            Get Started
            <span className="inline-block ml-1.5 transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="text-[10px] text-[#bbb] uppercase tracking-widest font-medium">Powered by</span>
          <div className="flex items-center gap-2">
            <Chip label="Gemini" icon="✦" />
            <Chip label="UMBC COEIT" icon="🎓" />
            <Chip label="Playwright" icon="🎭" />
          </div>
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-[#bbb] z-10 select-none italic">
        For every COEIT student who opens their window and finds the seat already gone.
      </p>
    </div>
  )
}

function Chip({ label, icon }) {
  return (
    <span className="flex items-center gap-1 text-xs text-[#888] bg-white/70 backdrop-blur-sm border border-[#e8e7e0] px-2.5 py-1 rounded-full">
      <span>{icon}</span><span>{label}</span>
    </span>
  )
}

function Blobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-[#FFC300]/25 blur-[80px]" />
      <div className="absolute top-[50%] right-[10%] w-64 h-64 rounded-full bg-[#FFC300]/20 blur-[90px]" />
      <div className="absolute bottom-[15%] left-[30%] w-56 h-56 rounded-full bg-[#FFC300]/15 blur-[70px]" />
      <div className="absolute top-[20%] right-[25%] w-48 h-48 rounded-full bg-black/5 blur-[60px]" />
      <Ring size={340} top="8%" left="5%" opacity={0.06} />
      <Ring size={280} top="55%" right="5%" opacity={0.05} />
      <Ring size={200} bottom="10%" left="55%" opacity={0.07} />
    </div>
  )
}

function Ring({ size, top, left, right, bottom, opacity }) {
  return (
    <div
      className="absolute rounded-full border border-[#FFC300]"
      style={{ width: size, height: size, top, left, right, bottom, opacity, transform: 'translate(-50%, -50%)' }}
    />
  )
}
