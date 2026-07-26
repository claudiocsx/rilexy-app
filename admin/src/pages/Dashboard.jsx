import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const INTENTIONS = {
  direct: { emoji: '🔥', label: 'Direto ao Ponto', color: '#EF4444' },
  party: { emoji: '⚡', label: 'Agitação', color: '#A855F7' },
  bar: { emoji: '🍸', label: 'Barzinho', color: '#F59E0B' },
  trust: { emoji: '💭', label: 'Chat de Confiança', color: '#3B82F6' },
};

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, banned: 0 });
  const [intentions, setIntentions] = useState({ direct: 0, party: 0, bar: 0, trust: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      let total = 0, approved = 0, pending = 0, banned = 0;
      const counts = { direct: 0, party: 0, bar: 0, trust: 0 };

      snap.docs.forEach((doc) => {
        const data = doc.data();
        total++;
        const st = data.status;
        if (st === 'approved' || !st) approved++;
        else if (st === 'pending') pending++;
        else if (st === 'banned') banned++;

        if (data.intention && counts[data.intention] !== undefined) {
          counts[data.intention]++;
        }
      });

      setStats({ total, approved, pending, banned });
      setIntentions(counts);
    });

    return unsub;
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total de Usuários</span>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#34d399' }}>
          <span className="stat-value">{stats.approved}</span>
          <span className="stat-label">Aprovados</span>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#fbbf24' }}>
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">Pendentes</span>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#f87171' }}>
          <span className="stat-value">{stats.banned}</span>
          <span className="stat-label">Banidos</span>
        </div>
      </div>

      <h2 style={{ marginTop: 32, marginBottom: 16, color: '#e2e8f0', fontSize: 18, fontWeight: 600 }}>
        Radar de Intenções
      </h2>
      <div className="intentions-grid">
        {Object.entries(INTENTIONS).map(([key, int]) => (
          <div key={key} className="intention-card" style={{ borderLeftColor: int.color }}>
            <span className="intention-emoji">{int.emoji}</span>
            <div>
              <span className="intention-count">{intentions[key]}</span>
              <span className="intention-label">{int.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
