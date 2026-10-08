'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';

interface Props { onClose: () => void; }

export default function ProfileModal({ onClose }: Props) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setSaving(true); setError('');
    try {
      const updated = await usersApi.updateMe({ display_name: displayName.trim(), about, phone });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', flex: 1 }}>Profile Settings</h2>
          <button className="btn-ghost" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Avatar user={user} size={80} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, background: 'var(--signal-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-primary)', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="white" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{user?.username}</p>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 5, fontWeight: 500 }}>Display Name *</label>
            <input className="signal-input" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 5, fontWeight: 500 }}>About</label>
            <input className="signal-input" value={about}
              onChange={(e) => setAbout(e.target.value)} placeholder="Hey there! I'm using Signal" maxLength={139} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>{about.length}/139</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 5, fontWeight: 500 }}>Phone</label>
            <input className="signal-input" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" />
          </div>
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Info */}
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Account Info</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {[
              ['Username', `@${user?.username}`],
              ['Status', user?.is_online ? 'Online' : 'Offline'],
              ['Phone', user?.phone || 'Not set'],
              ['About', user?.about || 'Not set'],
            ].map(([label, val]) => (
              <div key={label}>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: 2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
