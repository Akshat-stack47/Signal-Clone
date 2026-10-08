'use client';
import { useState } from 'react';
import { contactsApi, usersApi } from '@/lib/api';
import { User } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface AddContactModalProps {
  onClose: () => void;
}

export default function AddContactModal({ onClose }: AddContactModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const handleSearch = async (q: string) => {
    setSearch(q);
    setError('');
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await usersApi.list(q);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (u: User) => {
    try {
      await contactsApi.add(u.username);
      setAddedIds((prev) => new Set([...prev, u.id]));
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', flex: 1 }}>Add Contact</h2>
          <button className="btn-ghost" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input
          className="signal-input"
          placeholder="Search by username or name..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
          style={{ marginBottom: 12 }}
        />

        {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>}

        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              Searching...
            </div>
          )}
          {!loading && search && results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              No users found for &quot;{search}&quot;
            </div>
          )}
          {results.map((u) => {
            const added = addedIds.has(u.id);
            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--border-primary)',
              }}>
                <Avatar user={u} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{u.display_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                </div>
                <button
                  className={added ? 'btn-ghost' : 'btn-primary'}
                  onClick={() => !added && handleAdd(u)}
                  style={{ padding: '6px 14px', fontSize: '0.8125rem', borderRadius: 8 }}
                  disabled={added}
                >
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>

        <button className="btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>
          Done
        </button>
      </div>
    </div>
  );
}
