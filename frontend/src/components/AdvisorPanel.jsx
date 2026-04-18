import { useState } from 'react'
import { Sparkles, ChevronRight, Brain } from 'lucide-react'
import AdvisorAsk from './AdvisorAsk'

/**
 * Atlas Advisor — right-side chat panel. Claude 3.5 Sonnet drives the
 * conversation; the `launch_pilot` tool kicks off the registration agent and
 * its progress streams inline into this same chat.
 */
export default function AdvisorPanel({ mapData, onPilotComplete }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!mapData) return null

  return (
    <aside
      className="shrink-0 border-l border-[#e8e7e0] bg-gradient-to-b from-[#fdfdf8] to-[#f5f3eb] flex flex-col overflow-hidden transition-[width] duration-300"
      style={{ width: collapsed ? 44 : 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#e8e7e0] shrink-0 bg-white/50 backdrop-blur-sm">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFC300] to-[#FFD84D] shadow-[0_2px_8px_rgba(255,195,0,0.25)]">
                <Sparkles size={15} strokeWidth={2.4} className="text-black" />
              </div>
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-[13px] font-bold text-[#1a1a1a] truncate">Atlas Advisor</p>
              <p className="text-[9.5px] text-[#999] flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                live · Claude Sonnet 4.5 · agent mode
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-lg hover:bg-white/80 text-[#777] hover:text-[#111] transition-colors shrink-0"
          title={collapsed ? 'Expand advisor' : 'Collapse'}
        >
          <ChevronRight
            size={14}
            className="transition-transform"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {collapsed ? (
        <div className="flex-1 flex flex-col items-center pt-4 gap-3 text-[#aaa]">
          <Brain size={16} />
        </div>
      ) : (
        <AdvisorAsk mapData={mapData} onPilotComplete={onPilotComplete} />
      )}
    </aside>
  )
}
