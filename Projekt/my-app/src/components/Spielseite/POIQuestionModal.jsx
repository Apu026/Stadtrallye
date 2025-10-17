import React, { useEffect, useMemo, useState } from 'react';
import './POIQuestionModal.css';

function extractOptions(q) {
  const arrs = ['options','answers','antworten','choices','auswahl'];
  for (const k of arrs) if (Array.isArray(q?.[k])) return q[k].map(String);
  const objs = ['answerOptions','optionsObj','choicesObj'];
  for (const k of objs) if (q?.[k] && typeof q[k] === 'object') return Object.values(q[k]).map(String);
  const out = [];
  const add = (v) => { if (v != null && String(v).trim() !== '') out.push(String(v)); };
  ['option1','option2','option3','option4','a1','a2','a3','a4','antwort1','antwort2','antwort3','antwort4','optionA','optionB','optionC','optionD','a','b','c','d']
    .forEach(f => add(q?.[f]));
  return out;
}

export default function POIQuestionModal({ poi, open, isNearby, onAnswered, onClose }) {
  const [openedAt, setOpenedAt] = useState(0);
  const [selectedByQid, setSelectedByQid] = useState({});
  const [localAnswered, setLocalAnswered] = useState({});

  const questions = useMemo(() => (poi?.questions || []).map(q => ({
    ...q,
    options: extractOptions(q),
    correct_answer: Number(q.correct_answer ?? q.correct ?? q.correct_index ?? 1)
  })), [poi]);

  const isAnswered = (q) => !!(q?.userAnswers?.length) || !!localAnswered[q.id];

  useEffect(() => {
    if (!open || !poi) return;
    setOpenedAt(Date.now());
    setLocalAnswered({});
    const map = {};
    questions.forEach((q) => {
      const ua = q?.userAnswers?.length ? Number(q.userAnswers[0]) : null;
      map[q.id] = ua ?? null;
    });
    setSelectedByQid(map);
  }, [open, poi, questions]);

  const nextIndex = useMemo(() => questions.findIndex(q => !isAnswered(q)), [questions, localAnswered]);
  if (!poi || !open) return null;

  const currentQ = nextIndex >= 0 ? questions[nextIndex] : null;

  const handleSubmit = (q) => {
    if (!poi || !q || !isNearby || isAnswered(q)) return;
    const selected = selectedByQid[q.id];
    if (selected == null) return;
    const wasCorrect = String(selected) === String(q.correct_answer);
    setLocalAnswered((prev) => ({ ...prev, [q.id]: true }));
    onAnswered?.(q.id, selected, wasCorrect);
  };

  const handleBackdropClick = (e) => {
    e.stopPropagation();
    if (Date.now() - openedAt < 200) return;
    onClose?.();
  };

  return (
    <div className="pqm-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="pqm" onClick={(e) => e.stopPropagation()}>
        {!isNearby && <div className="pqm-note">Du bist zu weit entfernt. Gehe näher an den Standort.</div>}

        {currentQ ? (
          <div className="pqm-body">
            <div className="pqm-question">
              <div className="pqm-qtext">{currentQ.text || currentQ.question || ''}</div>
              <div className="pqm-options">
                {(currentQ.options || []).map((opt, i) => {
                  const value = i + 1;
                  const checked = selectedByQid[currentQ.id] === value;
                  return (
                    <label key={value} className="pqm-opt">
                      <input
                        type="radio"
                        name={`q_${currentQ.id}`}
                        value={value}
                        checked={!!checked}
                        onChange={() => {
                          if (!isNearby) return;
                          setSelectedByQid(prev => ({ ...prev, [currentQ.id]: value }));
                        }}
                        disabled={!isNearby}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
                {(!currentQ.options || currentQ.options.length === 0) && (
                  <div style={{ color: '#b00' }}>Keine Antwortoptionen verfügbar.</div>
                )}
              </div>
              <div className="pqm-actions">
                <button
                  className="pqm-btn pqm-btn-primary"
                  onClick={() => handleSubmit(currentQ)}
                  disabled={!isNearby || selectedByQid[currentQ.id] == null}
                >
                  Antwort senden
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pqm-body"><div className="pqm-qtext">Alle Fragen beantwortet.</div></div>
        )}

        <div className="pqm-footer">
          <button className="pqm-btn" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}