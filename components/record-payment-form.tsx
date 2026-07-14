import React, { useState } from 'react'
import { Coins } from 'lucide-react'
import { toast } from 'sonner'

interface RecordPaymentFormProps {
  title: string
  subtitle?: string
  amountLabel: string
  onSubmit: (amount: string, mode: string, txnId: string) => void
  submitButtonText?: string
}

export function RecordPaymentForm({
  title,
  subtitle = 'Direct credit reconciliation',
  amountLabel,
  onSubmit,
  submitButtonText = 'Add and Verify',
}: RecordPaymentFormProps) {
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('Bank Transfer')
  const [txnId, setTxnId] = useState('')

  const handleSub = () => {
    onSubmit(amount, mode, txnId)
    setAmount('')
    setTxnId('')
  }

  return (
    <section className="bg-[#191D2E]/60 backdrop-blur-md border border-[#283150] rounded-xl p-5 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#22d3ee]/10 flex items-center justify-center text-[#22d3ee]">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#dce1ff]">{title}</h3>
            <p className="text-xs text-[#c7c6cd]">{subtitle}</p>
          </div>
        </div>
        <div className="flex-1 flex flex-wrap gap-4 items-center lg:justify-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#c7c6cd] uppercase tracking-wider">{amountLabel}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c6cd]/60 text-xs">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-48 bg-[#07112f] border-[#283150] rounded-lg text-xs pl-7 text-[#dce1ff] placeholder-[#c7c6cd]/30 focus:ring-1 focus:ring-[#22d3ee] focus:border-[#22d3ee] focus:outline-none h-9"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#c7c6cd] uppercase tracking-wider">Payment Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-56 bg-[#07112f] border-[#283150] rounded-lg text-xs text-[#dce1ff] focus:ring-1 focus:ring-[#22d3ee] focus:border-[#22d3ee] focus:outline-none h-9 px-2"
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[#c7c6cd] uppercase tracking-wider">Transaction ID</label>
            <input
              type="text"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              className="w-44 bg-[#07112f] border-[#283150] rounded-lg text-xs text-[#dce1ff] placeholder-[#c7c6cd]/30 focus:ring-1 focus:ring-[#22d3ee] focus:border-[#22d3ee] focus:outline-none h-9 px-3"
              placeholder="TXN-XXXXXX"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              onClick={handleSub}
              className="bg-[#22d3ee] text-[#07112f] font-bold px-5 h-9 rounded-lg text-xs hover:brightness-110 transition-all shadow-md shadow-[#22d3ee]/20"
            >
              {submitButtonText}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
