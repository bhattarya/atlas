import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-[#f7f6f1]">
      <Blobs />

      <div className="relative z-10 flex flex-col items-center text-center gap-5 px-6 max-w-xl">
        <h1 className="text-6xl font-bold tracking-tight text-black select-none">Atlas</h1>

        <p className="text-[15px] text-[#666] leading-relaxed max-w-sm">
          Class standing decides who gets to plan.<br />
          Atlas decides who gets to win.
        </p>

        <div className="mt-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-2.5 rounded-full bg-black text-[#FFC300] text-sm font-semibold hover:bg-[#111] transition-colors shadow-sm"
          >
            Get Started
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

      <p className="absolute bottom-6 text-xs text-[#bbb] z-10 select-none">
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
