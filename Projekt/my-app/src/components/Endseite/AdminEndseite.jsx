import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || '';

export default function AdminEndseite() {
  const { roomCode: roomCodeParam } = useParams();
  const roomCode = (roomCodeParam || '').toUpperCase();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      const sgUrl = `${API_BASE}/api/sessiongroups${roomCode ? `?roomCode=${encodeURIComponent(roomCode)}` : ''}`;
      const [sgRes, gnRes] = await Promise.all([
        fetch(sgUrl),
        fetch(`${API_BASE}/api/group-names`)
      ]);
      if (!sgRes.ok) throw new Error('sessiongroups failed');
      if (!gnRes.ok) throw new Error('group-names failed');
      const sgBody = await sgRes.json();
      const gnBody = await gnRes.json();
      const sgs = Array.isArray(sgBody) ? sgBody : (sgBody.sessiongroups || []);
      const groupNamesArr = Array.isArray(gnBody) ? gnBody : (gnBody.groupNames || []);
      const nameMap = {};
      groupNamesArr.forEach(g => { nameMap[g.group_id ?? g.id] = g.group_name ?? g.name ?? g.groupName; });
      // choose session by roomCode if provided
      const filtered = sgs.filter(s => !roomCode || s.entry_code?.toUpperCase?.() === roomCode || true);
      filtered.sort((a,b) => (Number(b.points||0) - Number(a.points||0)));
      const lb = filtered.map((g, idx) => ({ id: g.group_id, name: nameMap[g.group_id] || `Team ${g.group_id}`, points: Number(g.points||0) }));
      setLeaderboard(lb);
      setError('');
    } catch (e) {
      setError('Konnte Rangliste nicht laden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeaderboard(); }, [roomCode]);

  async function triggerCeremony() {
    try {
      const res = await fetch(`${API_BASE}/api/page/adminendseite/ceremony-start?roomCode=${encodeURIComponent(roomCode)}`, { method: 'POST' });
      if (!res.ok) throw new Error('trigger failed');
      // Optional: refresh leaderboard
      fetchLeaderboard();
      alert('Siegerehrung ausgelöst. Teilnehmer sehen nun die Rangliste.');
    } catch (e) {
      alert('Fehler beim Auslösen der Siegerehrung');
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate(`/admin/live/${encodeURIComponent(roomCode)}`); }}>
          Zurück zur Live-Map
        </button>
        <h2>Auswertung</h2>
        <div style={{ width: 160 }} />
      </div>

      <div style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', padding: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Session</div>
            <div style={{ color: '#666' }}>Raum-Code: {roomCode || '—'}</div>
          </div>
          <button onClick={triggerCeremony} disabled={!roomCode} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#083163', color: '#fff' }}>
            Siegerehrung auslösen
          </button>
        </div>

        <hr />
        <h3 style={{ textAlign: 'center', margin: '8px 0' }}>Leaderboard</h3>
        {loading ? (
          <div>Lade Rangliste…</div>
        ) : error ? (
          <div style={{ color: 'crimson' }}>{error}</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {leaderboard.map((t, i) => (
              <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: '#f7f7f7', marginBottom: 6 }}>
                <span>{i + 1}. {t.name}</span>
                <span>{t.points} Punkte</span>
              </li>
            ))}
            {leaderboard.length === 0 && <li style={{ textAlign: 'center', color: '#666' }}>Keine Teilnehmer</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
