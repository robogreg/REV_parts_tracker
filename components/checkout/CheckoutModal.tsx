'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TeamSearch } from './TeamSearch';
import { Spinner } from '@/components/ui/Spinner';
import { useCartStore, useAppStore } from '@/lib/store';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/components/auth/AuthProvider';
import { Transaction, TransactionItem, Team } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { savePendingTransaction } from '@/lib/offline';
import { getAuthHeaders } from '@/lib/firebase-client';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (tx: Transaction) => void;
}

export function CheckoutModal({ open, onClose, onSuccess }: CheckoutModalProps) {
  const { user } = useAuth();
  const activeEvent = useAppStore((s) => s.activeEvent);
  const isOnline = useAppStore((s) => s.isOnline);
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const { data: teams = [] } = useTeams(activeEvent?.id);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamText, setTeamText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!teamText.trim()) e.team = 'Team is required';
    if (!contactName.trim()) e.contactName = 'Contact name is required';
    if (!contactEmail.trim()) e.contactEmail = 'Contact email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) e.contactEmail = 'Invalid email';
    if (reason.length > 200) e.reason = 'Max 200 characters';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);

    const txItems: TransactionItem[] = cartItems.map((ci) => ({
      partId: ci.part.id,
      partName: ci.part.name,
      sku: ci.part.sku,
      quantity: ci.quantity,
      unitType: ci.unitType,
      isLoaner: ci.isLoaner,
      condition: ci.condition ?? 'new',
    }));

    const tx: Transaction = {
      id: generateId(),
      localId: generateId(),
      eventId: activeEvent!.id,
      eventName: activeEvent!.name,
      teamNumber: selectedTeam?.teamNumber ?? teamText,
      teamName: selectedTeam?.teamName ?? teamText,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      reason: reason.trim() || undefined,
      staffEmail: user!.email,
      staffName: user!.name,
      staffPhotoUrl: user!.photoUrl,
      items: txItems,
      totalItems: txItems.reduce((s, i) => s + i.quantity, 0),
      timestamp: new Date().toISOString(),
      syncStatus: 'pending',
    };

    try {
      if (isOnline) {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(tx),
        });
        if (!res.ok) throw new Error('Failed to create transaction');
        const { transaction } = await res.json();
        clearCart();
        onSuccess(transaction);
        toast.success(`Parts given to Team ${tx.teamNumber}`);
      } else {
        await savePendingTransaction(tx);
        clearCart();
        onSuccess(tx);
        toast('Saved offline — will sync when connected', {
          icon: '💾',
          style: { background: '#78350f', color: '#fcd34d', border: '1px solid #92400e' },
          duration: 5000,
        });
      }
      onClose();
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const loanerItems = cartItems.filter((i) => i.isLoaner);

  return (
    <Modal open={open} onClose={onClose} title="Check Out" size="lg">
      <div className="px-6 py-4 space-y-5">
        {/* Team */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
            Team <span className="text-red-400">*</span>
          </label>
          <TeamSearch
            teams={teams}
            value={teamText}
            onSelect={(team, text) => { setSelectedTeam(team); setTeamText(text); }}
            error={errors.team}
          />
        </div>

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
            Contact Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Full name"
            className={`w-full bg-[#242424] border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors ${errors.contactName ? 'border-red-600' : 'border-[#2E2E2E]'}`}
          />
          {errors.contactName && <p className="text-xs text-red-400 mt-1">{errors.contactName}</p>}
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
            Contact Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="student@team.org"
            className={`w-full bg-[#242424] border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors ${errors.contactEmail ? 'border-red-600' : 'border-[#2E2E2E]'}`}
          />
          {errors.contactEmail && <p className="text-xs text-red-400 mt-1">{errors.contactEmail}</p>}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Why are these parts being given? (optional)"
            className={`w-full bg-[#242424] border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors resize-none ${errors.reason ? 'border-red-600' : 'border-[#2E2E2E]'}`}
          />
          <div className="flex justify-between">
            {errors.reason && <p className="text-xs text-red-400 mt-1">{errors.reason}</p>}
            <p className="text-xs text-[#9CA3AF] mt-1 ml-auto">{reason.length}/200</p>
          </div>
        </div>

        {/* Cart summary */}
        <div>
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-2">
            Items ({cartItems.reduce((s, i) => s + i.quantity, 0)} units)
          </h3>
          <div className="bg-[#0F0F0F] rounded-lg divide-y divide-[#2E2E2E]">
            {cartItems.map((item) => (
              <div key={item.part.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm text-white">{item.part.name}</p>
                  <p className="text-xs font-mono text-[#9CA3AF]">{item.part.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">×{item.quantity}</span>
                  {item.isLoaner && <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loaner reminder */}
        {loanerItems.length > 0 && (
          <div className="bg-[#FF6B00]/10 border border-[#FF6B00]/30 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-[#FF6B00]">
            <Lock className="w-4 h-4 flex-shrink-0" />
            {loanerItems.length} loaner item{loanerItems.length !== 1 ? 's' : ''} — remind team to return
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || cartItems.length === 0}
          className="w-full py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e55a00] text-white font-display text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? <Spinner size="sm" className="text-white" /> : null}
          Give Parts{selectedTeam ? ` to Team ${selectedTeam.teamNumber}` : ''}
        </button>
      </div>
    </Modal>
  );
}
