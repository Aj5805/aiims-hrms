import { useState, useEffect } from 'react';
import { broadcastsApi } from '../api/endpoints';

export function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        const { data } = await broadcastsApi.getActive();
        setBroadcasts(data || []);
      } catch (err) {
        // silently ignore error if unauthenticated or network issue
      }
    };
    fetchBroadcasts();
    // Poll every 30 seconds
    const interval = setInterval(fetchBroadcasts, 30000);
    return () => clearInterval(interval);
  }, []);

  if (broadcasts.length === 0) return null;

  return (
    <div className="w-full flex flex-col shrink-0">
      {broadcasts.map(b => (
        <div 
          key={b.id} 
          className={`flex items-center justify-center px-4 py-2 text-sm font-medium z-50 shadow-md ${
            b.type === 'error' ? 'bg-red-600 text-white' :
            b.type === 'warning' ? 'bg-amber-500 text-amber-950' :
            'bg-blue-600 text-white'
          }`}
        >
          {b.type === 'warning' && (
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {b.type === 'error' && (
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {b.type === 'info' && (
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{b.message}</span>
        </div>
      ))}
    </div>
  );
}
