'use client';

import { useEffect } from 'react';

export default function EmailWatcherInitializer() {
  useEffect(() => {
    // Inicializar watchers apenas uma vez quando o componente montar
    const initializeWatchers = async () => {
      try {
        // Fazer uma requisição para inicializar os watchers
        await fetch('/api/email-watcher/init', { method: 'POST' });
      } catch (error) {
        console.error('❌ Erro ao inicializar email watchers:', error);
      }
    };

    initializeWatchers();
  }, []);

  // Este componente não renderiza nada visualmente
  return null;
} 