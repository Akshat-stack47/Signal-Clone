'use client';
import { User } from '@/types';

interface AvatarProps {
  user?: User | null;
  name?: string;
  size?: number;
  className?: string;
}

const COLORS = [
  ['#3A76F0', '#2CA5E0'], ['#E53935', '#FF7043'],
  ['#43A047', '#00BFA5'], ['#8E24AA', '#D81B60'],
  ['#FB8C00', '#F4511E'], ['#00ACC1', '#0097A7'],
];

function getColorPair(name: string): string[] {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function Avatar({ user, name, size = 44, className = '' }: AvatarProps) {
  const displayName = user?.display_name || name || '?';
  const avatarUrl = user?.avatar_url;
  const [c1, c2] = getColorPair(displayName);

  const style = { width: size, height: size, minWidth: size, fontSize: size > 36 ? '1rem' : '0.75rem' };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={displayName} className={`avatar ${className}`} style={style} />
    );
  }

  return (
    <div
      className={`avatar ${className}`}
      style={{ ...style, background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}
