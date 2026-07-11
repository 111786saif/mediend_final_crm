'use client'

import React from 'react'

interface RecentActivityLogProps {
  className?: string
}

export function RecentActivityLog({ className = '' }: RecentActivityLogProps) {
  return (
    <div className={`bg-[#191D2E]/60 backdrop-blur-md border border-[#283150] rounded-xl flex flex-col shadow-lg ${className}`}>
      <div className="px-3.5 py-2 border-b border-[#283150] flex items-center justify-between">
        <h3 className="font-bold text-xs text-white">Recent Activity Log</h3>
        <span className="text-xs text-[#22d3ee] hover:underline cursor-pointer">View All</span>
      </div>
      <div className="p-3 space-y-2">
        {/* Activity Item 1 */}
        <div className="flex items-start gap-2">
          <div className="mt-1.5 w-1 h-1 rounded-full bg-yellow-500 shrink-0"></div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#dce1ff]">Payment of <span className="font-bold text-[#22d3ee]">₹5,000</span> received (TXN: 88291)</p>
              <span className="text-[10px] text-[#c7c6cd]/55 font-mono">2h ago</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#c7c6cd] italic">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Pending Verification
            </div>
          </div>
        </div>
        {/* Divider */}
        <div className="h-px bg-[#283150]/20"></div>
        {/* Activity Item 2 */}
        <div className="flex items-start gap-2">
          <div className="mt-1.5 w-1 h-1 rounded-full bg-green-500 shrink-0"></div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#dce1ff]">Verified <span className="font-bold text-emerald-400">₹10,000</span> payment by Sarah Miller</p>
              <span className="text-[10px] text-[#c7c6cd]/55 font-mono">5h ago</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#c7c6cd]">
              <span className="text-emerald-400">✔</span> Auto-reconciled to Case #CASE-9844
            </div>
          </div>
        </div>
        {/* Divider */}
        <div className="h-px bg-[#283150]/20"></div>
        {/* Activity Item 3 */}
        <div className="flex items-start gap-2">
          <div className="mt-1.5 w-1 h-1 rounded-full bg-[#22d3ee] shrink-0"></div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#dce1ff]">Quarterly Statement Generated</p>
              <span className="text-[10px] text-[#c7c6cd]/55 font-mono">Yesterday</span>
            </div>
            <p className="text-[11px] text-[#c7c6cd] mt-0.5">Available for download in the archives</p>
          </div>
        </div>
      </div>
    </div>
  )
}
