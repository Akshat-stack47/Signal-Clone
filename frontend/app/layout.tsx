import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import ToastContainer from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Signal Clone - Secure Messaging',
  description: 'A Signal-inspired secure messaging application built with Next.js and FastAPI',
  keywords: ['signal', 'messaging', 'encrypted', 'real-time', 'chat'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ChatProvider>
            {children}
            <ToastContainer />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
