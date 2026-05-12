import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

const ACTIVITY_REASONS = [
  { id: 'dangerous_route', label: 'Dangerous route / area' },
  { id: 'out_of_date',     label: 'Route is out of date / no longer exists' },
  { id: 'does_not_exist',  label: 'Activity does not exist anymore' },
  { id: 'spam',            label: 'Spam or misleading content' },
  { id: 'offensive_content', label: 'Offensive content' },
  { id: 'other',           label: 'Other' },
];

const USER_REASONS = [
  { id: 'harassment',      label: 'Harassment or bullying' },
  { id: 'offensive_content', label: 'Offensive content / comments' },
  { id: 'spam',            label: 'Spam' },
  { id: 'dangerous_route', label: 'Creates dangerous activities' },
  { id: 'other',           label: 'Other' },
];

/**
 * Report modal — works for both activity reports and user reports.
 *
 * Props:
 *   isOpen, onClose
 *   target: { kind: 'activity'|'user', id: number, label: string }
 */
export function ReportModal({ isOpen, onClose, target }) {
  const token = useAuthStore(s => s.token);
  const addToast = useToastStore(s => s.addToast);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!target) return null;
  const reasons = target.kind === 'activity' ? ACTIVITY_REASONS : USER_REASONS;

  const handleSubmit = async () => {
    if (!reason) {
      addToast('Pick a reason first', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const url = target.kind === 'activity' ? '/api/reports/activity' : '/api/reports/user';
      const body = target.kind === 'activity'
        ? { activity_id: target.id, reason, details: details.trim() || null }
        : { reported_user_id: target.id, reason, details: details.trim() || null };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit report');
      }
      addToast('Report submitted — thank you. Admins will review it.', 'success');
      setReason(''); setDetails('');
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to submit report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Report ${target.kind === 'activity' ? 'activity' : 'user'}: ${target.label}`}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Reports are reviewed by admins. Please only report content that breaks community guidelines or poses a safety risk.
      </p>
      <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {reasons.map(r => (
          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '8px', border: reason === r.id ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)', background: reason === r.id ? 'rgba(76,175,80,0.1)' : 'var(--glass-bg)' }}>
            <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span style={{ fontSize: '0.9rem' }}>{r.label}</span>
          </label>
        ))}
      </div>
      <textarea
        value={details} onChange={e => setDetails(e.target.value)} rows={4}
        placeholder="Optional details (what specifically is wrong, where, etc.)"
        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting || !reason}>{submitting ? 'Sending…' : 'Submit Report'}</Button>
      </div>
    </Modal>
  );
}
