import React, { useState, useEffect } from 'react';

export default function POIQuestionModal({ poi, open, isNearby, onAnswered, onClose }) {
  const [qIndex, setQIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [msg, setMsg] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Reset, wenn POI wechselt
  useEffect(() => {
    setQIndex(0);
    setChoice(null);
    setMsg('');
    setFeedback(null);
  }, [poi, open]);

  if (!poi || !open) return null;

  const questions = poi.questions || [];
  const current = questions[qIndex];

  function submit() {
    if (!isNearby) {
      setMsg('Du bist nicht nah genug an diesem Punkt.');
      return;
    }
    if (!current) return;

    // Validate choice
    if (current.answers && current.answers.length) {
      if (choice === null || choice === undefined) {
        setMsg('Bitte wähle eine Antwort.');
        return;
      }
    } else {
      if (!(choice || '').trim()) {
        setMsg('Bitte gib eine Antwort ein.');
        return;
      }
    }

    const given = current.answers?.length ? Number(choice) : (choice || '').toString().trim();
    const correctIndex = Number(current.correctAnswerIndex);
    const isCorrect = current.answers?.length
      ? given === correctIndex
      : String(current.answers?.[correctIndex] ?? '').toLowerCase() === String(given).toLowerCase();

    setFeedback(isCorrect ? { type: 'success', text: 'Richtig!' } : { type: 'error', text: 'Falsch.' });
    onAnswered(current.id, given, isCorrect);

    if (isCorrect) {
      setTimeout(() => {
        setFeedback(null);
        const next = qIndex + 1;
        if (next < questions.length) {
          setQIndex(next);
          setChoice(null);
          setMsg('');
        } else {
          onClose();
        }
      }, 600);
    } else {
      setTimeout(() => {
        setFeedback(null);
        setMsg('Falsche Antwort. Versuch es noch einmal.');
      }, 900);
    }
  }

  return (
    <div style={backdrop}>
      <div style={box}>
        <h3>{poi.title}</h3>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{qIndex + 1}/{questions.length}</div>

        {feedback && (
          <div style={{
            marginBottom: 8,
            padding: '6px 8px',
            borderRadius: 6,
            fontWeight: 700,
            textAlign: 'left',
            color: feedback.type === 'success' ? '#064e13' : '#6b0505',
            background: feedback.type === 'success' ? 'rgba(198,255,207,0.95)' : 'rgba(255,223,223,0.95)'
          }}>
            {feedback.text}
          </div>
        )}

        <p style={{ textAlign: 'left' }}>{current.question}</p>

        {current.answers?.length ? (
        <div style={{ textAlign: 'left' }}>
            {current.answers.map((a, i) => (
            <label key={i} style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                <input
                type="radio"
                name="poi_q"
                value={i}
                checked={choice === i} // <-- nur exakt gleich
                onChange={e => { setChoice(i); setMsg(''); }} // <-- direkt i, nicht Number(e.target.value)
                style={{ marginRight: 8 }}
                />
                {a}
            </label>
            ))}
        </div>
        ) : (
        <input
            type="text"
            value={choice || ''}
            onChange={e => { setChoice(e.target.value); setMsg(''); }}
            placeholder="Antwort eingeben"
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
        )}


        {msg && <div style={{ color: 'crimson', marginTop: 8 }}>{msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnSecondary}>Schließen</button>
          <button onClick={submit} style={btnPrimary}>{qIndex + 1 < questions.length ? 'Nächste Frage' : 'Fertig'}</button>
        </div>
      </div>
    </div>
  );
}

const backdrop = { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', zIndex: 3000 };
const box = { width: 420, maxWidth: 'calc(100% - 24px)', padding: 16, borderRadius: 8, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', textAlign: 'left' };
const btnPrimary = { background: '#0078d4', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' };
const btnSecondary = { background: '#eee', color: '#111', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' };
