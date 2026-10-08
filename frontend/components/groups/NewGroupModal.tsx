'use client';
import { useState } from 'react';
import { Conversation, User } from '@/types';
import { usersApi, groupsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';

interface Props { onClose: () => void; onCreated: (conv: Conversation) => void; }

export default function NewGroupModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'members' | 'name'>('members');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchResults(await usersApi.list(q).catch(() => []));
  };

  const toggle = (u: User) =>
    setSelected((prev) => prev.find((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]);

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('Group name is required'); return; }
    setLoading(true); setError('');
    try {
      const conv = await groupsApi.create(groupName.trim(), selected.map((u) => u.id));
      onCreated(conv); onClose();
    } catch (e: unknown) { setError((e as Error).message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', flex: 1 }}>
            {step === 'members' ? 'Add Members' : 'Name Your Group'}
          </h2>
          <button className="btn-ghost" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 'members' ? (
          <>
            <input className="signal-input" placeholder="Search users..." value={search}
              onChange={(e) => handleSearch(e.target.value)} autoFocus style={{ marginBottom: 12 }} />
            {selected.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selected.map((u) => (
                  <span key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--signal-blue-light)', color: 'var(--signal-blue)', borderRadius: 20, padding: '4px 10px', fontSize: '0.8125rem', fontWeight: 500 }}>
                    {u.display_name}
                    <button onClick={() => toggle(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', lineHeight: 1, fontSize: '1rem' }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
              {searchResults.length === 0 && search && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No users found</div>
              )}
              {searchResults.map((u) => {
                const sel = !!selected.find((s) => s.id === u.id);
                return (
                  <div key={u.id} className="conv-item" onClick={() => toggle(u)} style={{ background: sel ? 'var(--signal-blue-light)' : undefined }}>
                    <Avatar user={u} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{u.display_name}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                    </div>
                    {sel && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--signal-blue)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={() => selected.length > 0 && setStep('name')} disabled={selected.length === 0} style={{ flex: 2 }}>
                Next ({selected.length})
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="avatar" style={{ width: 72, height: 72, margin: '0 auto 12px', background: 'linear-gradient(135deg, #8E24AA, #D81B60)', fontSize: '1.75rem' }}>
                {groupName.charAt(0).toUpperCase() || 'G'}
              </div>
            </div>
            <input className="signal-input" placeholder="Group name" value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} autoFocus style={{ marginBottom: 8 }} />
            {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>}
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>{selected.length} member{selected.length !== 1 ? 's' : ''} selected</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => setStep('members')} style={{ flex: 1 }}>Back</button>
              <button className="btn-primary" onClick={handleCreate} disabled={loading || !groupName.trim()} style={{ flex: 2 }}>
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
