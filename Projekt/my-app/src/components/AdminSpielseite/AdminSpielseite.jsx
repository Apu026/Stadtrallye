import React, { useEffect, useState } from "react";
import AdminMapEditor from "./AdminMapEditor";
import "./AdminSpielseite.css";

// Importiere die Icons
import editIcon from '../../assets/edit-pencil.png';
import deleteIcon from '../../assets/trash-bin.png';

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "http://localhost:4000";

export default function AdminSpielseite() {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // local edit copy (includes questions[])
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/pois`);
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        if (mounted) setPois(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        if (mounted) setError("Konnte POIs nicht laden");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // create local tmp POI (not persisted)
  const createLocalPoi = ({ name = "Neuer POI", lat = 52.52, lng = 13.405, radius_meters = 50 } = {}) => {
    const tmpId = `tmp-${Date.now()}`;
    const tmp = { id: tmpId, name, lat, lng, radius_meters, questions: [] };
    setPois(prev => [tmp, ...prev]);
    setSelected(tmp);
    setEditing({ ...tmp });
    setDeletedQuestionIds([]);
    return tmp;
  };

  // update only local state (used for input changes and marker drag)
  const updateLocalPoi = (id, changes) => {
    setPois(prev => prev.map(p => (String(p.id) === String(id) ? { ...p, ...changes } : p)));
    if (editing && String(editing.id) === String(id)) setEditing(prev => ({ ...prev, ...changes }));
    if (selected && String(selected.id) === String(id)) setSelected(prev => ({ ...prev, ...changes }));
  };

  // QUESTION helpers (operate on editing.questions)
  const ensureEditingQuestions = () => {
    if (!editing) return;
    if (!Array.isArray(editing.questions)) setEditing(prev => ({ ...prev, questions: [] }));
  };

  const addQuestionToEditing = () => {
    if (!editing) return;
    const qId = `tmp-q-${Date.now()}`;
    const q = { id: qId, question: "", answers: ["", ""], correct_answer_idx: 0 };
    setEditing(prev => ({ ...prev, questions: [q, ...(prev.questions || [])] }));
  };

  const updateQuestionField = (qId, changes) => {
    if (!editing) return;
    setEditing(prev => ({
      ...prev,
      questions: (prev.questions || []).map(q => (String(q.id) === String(qId) ? { ...q, ...changes } : q))
    }));
  };

  const addAnswer = (qId) => {
    const q = editing.questions.find(q => String(q.id) === String(qId));
    if (!q) return;
    updateQuestionField(qId, { answers: [...q.answers, ""] });
  };

  const removeAnswer = (qId, idx) => {
    const q = editing.questions.find(q => String(q.id) === String(qId));
    if (!q) return;
    const answers = q.answers.filter((_, i) => i !== idx);
    let correct = q.correct_answer_idx;
    if (correct >= answers.length) correct = Math.max(0, answers.length - 1);
    updateQuestionField(qId, { answers, correct_answer_idx: correct });
  };

  const setCorrectAnswer = (qId, idx) => updateQuestionField(qId, { correct_answer_idx: idx });

  const deleteQuestionFromEditing = (qId) => {
    if (!editing) return;
    // if persisted question => mark for delete
    if (!String(qId).startsWith("tmp-")) {
      setDeletedQuestionIds(prev => [...prev, qId]);
    }
    setEditing(prev => ({ ...prev, questions: (prev.questions || []).filter(q => String(q.id) !== String(qId)) }));
  };

  // save local editing to server (POST if tmp, PUT if existing)
  const saveEditingPoi = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editing.name,
        lat: Number(editing.lat),
        lng: Number(editing.lng),
        radius_meters: Number(editing.radius_meters || 50)
      };

      let poiId = editing.id;
      if (String(editing.id).startsWith("tmp-")) {
        const res = await fetch(`${API_BASE}/api/pois`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("create failed");
        const created = await res.json();
        // replace tmp in list
        setPois(prev => prev.map(p => (String(p.id) === String(editing.id) ? created : p)));
        setSelected(created);
        setEditing(created);
        poiId = created.id;
      } else {
        const res = await fetch(`${API_BASE}/api/pois/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("update failed");
        const updated = await res.json();
        setPois(prev => prev.map(p => (String(p.id) === String(updated.id) ? updated : p)));
        setSelected(updated);
        setEditing(prev => ({ ...updated, questions: prev.questions || [] })); // keep local questions
        poiId = updated.id;
      }

      // QUESTIONS: handle deletes
      for (const qid of deletedQuestionIds) {
        try {
          await fetch(`${API_BASE}/api/questions/${qid}`, { method: "DELETE" });
        } catch (e) { console.warn("delete question failed", qid, e); }
      }
      setDeletedQuestionIds([]);

      // QUESTIONS: upsert current questions
      const qs = editing.questions || [];
      const savedQuestions = [];
      for (const q of qs) {
        if (String(q.id).startsWith("tmp-")) {
          // create
          const res = await fetch(`${API_BASE}/api/pois/${poiId}/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q.question,
              answers: q.answers,
              correct_answer_idx: q.correct_answer_idx
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            console.error("create question failed", txt);
            continue;
          }
          const created = await res.json();
          savedQuestions.push(created);
        } else {
          // update
          const res = await fetch(`${API_BASE}/api/questions/${q.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q.question,
              answers: q.answers,
              correct_answer_idx: q.correct_answer_idx
            }),
          });
          if (!res.ok) {
            console.error("update question failed", await res.text());
            continue;
          }
          const updated = await res.json();
          savedQuestions.push(updated);
        }
      }

      // refresh questions from server for poiId
      try {
        const res = await fetch(`${API_BASE}/api/pois/${poiId}/questions`);
        if (res.ok) {
          const remoteQs = await res.json();
          // attach to editing and to pois entry
          setEditing(prev => ({ ...prev, questions: remoteQs }));
          setPois(prev => prev.map(p => (String(p.id) === String(poiId) ? { ...p, questions: remoteQs } : p)));
        }
      } catch (e) { console.warn("refresh questions failed", e); }

    } catch (err) {
      console.error(err);
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (!editing) return;
    if (String(editing.id).startsWith("tmp-")) {
      setPois(prev => prev.filter(p => String(p.id) !== String(editing.id)));
    } else {
      const original = pois.find(p => String(p.id) === String(editing.id));
      if (original) setSelected(original);
    }
    setEditing(null);
    setSelected(null);
    setDeletedQuestionIds([]);
  };

  const deletePoi = async (id) => {
    if (!confirm("POI löschen?")) return;
    if (String(id).startsWith("tmp-")) {
      setPois(prev => prev.filter(p => String(p.id) !== String(id)));
      if (editing && String(editing.id) === String(id)) setEditing(null);
      if (selected && String(selected.id) === String(id)) setSelected(null);
      return;
    }
    const res = await fetch(`${API_BASE}/api/pois/${id}`, { method: "DELETE" });
    if (res.status !== 204 && !res.ok) {
      const txt = await res.text();
      console.error(`DELETE failed`, res.status, txt);
      setError("Löschen fehlgeschlagen");
      return;
    }
    setPois(prev => prev.filter(p => String(p.id) !== String(id)));
    setEditing(null);
    setSelected(null);
  };

  return (
    <div className="admin-shell">
      <AdminMapEditor
        pois={pois}
        /* onCreateLocal removed: create via button only */
        onSelect={(p) => {
          // load questions for existing poi into editing
          setSelected(p);
          const loadQuestions = async () => {
            if (!p || String(p.id).startsWith("tmp-")) {
              setEditing({ ...p, questions: p.questions || [] });
              setDeletedQuestionIds([]);
              return;
            }
            try {
              const res = await fetch(`${API_BASE}/api/pois/${p.id}/questions`);
              if (res.ok) {
                const qs = await res.json();
                setEditing({ ...p, questions: qs });
              } else {
                setEditing({ ...p, questions: [] });
              }
              setDeletedQuestionIds([]);
            } catch (e) {
              console.error("load questions failed", e);
              setEditing({ ...p, questions: [] });
            }
          };
          loadQuestions();
        }}
        onMoveLocal={(id, lat, lng) => updateLocalPoi(id, { lat, lng })}
      />

      <aside className="admin-panel" aria-label="POI Admin Panel">
        <h3>POI Admin</h3>
        {loading && <div className="muted">Lade POIs…</div>}
        {error && <div className="error">{error}</div>}

        <div className="panel-actions">
          <button onClick={() => createLocalPoi()}>+ Neuer POI</button>
          <button onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE}/api/pois`);
              if (!res.ok) throw new Error("fetch failed");
              const data = await res.json();
              setPois(Array.isArray(data) ? data : []);
            } catch (e) {
              console.error(e);
              setError("Aktualisierung fehlgeschlagen");
            } finally {
              setLoading(false);
            }
          }}>Aktualisieren</button>
        </div>

        <hr />

        <div className="poi-list">
          {pois.map(p => (
            <div key={p.id} className={`poi-item ${selected?.id === p.id ? 'active' : ''}`}>
              <div className="poi-info" onClick={() => { setSelected(p); setEditing({ ...p, questions: p.questions || [] }); }}>
                <strong>{p.name}</strong>
                <div className="small">{p.lat?.toFixed?.(5)} , {p.lng?.toFixed?.(5)}</div>
              </div>
              <div className="poi-actions" style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setSelected(p); setEditing({ ...p, questions: p.questions || [] }); }} title="Bearbeiten">
                  <img src={editIcon} alt="Bearbeiten" style={{ width: 20, height: 20 }} />
                </button>
                <button type="button" onClick={() => deletePoi(p.id)} title="Löschen">
                  <img src={deleteIcon} alt="Löschen" style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>
          ))}
          {pois.length === 0 && <div className="muted">Keine POIs</div>}
        </div>

        {editing && (
          <>
            <hr />
            <h4>Bearbeite POI</h4>
            <form onSubmit={async (e) => { e.preventDefault(); await saveEditingPoi(); }}>
              <label>Name
                <input value={editing.name || ""} onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))} />
              </label>
              <label>Lat
                <input value={editing.lat ?? ""} onChange={(e) => { setEditing(prev => ({ ...prev, lat: e.target.value })); updateLocalPoi(editing.id, { lat: e.target.value }); }} />
              </label>
              <label>Lng
                <input value={editing.lng ?? ""} onChange={(e) => { setEditing(prev => ({ ...prev, lng: e.target.value })); updateLocalPoi(editing.id, { lng: e.target.value }); }} />
              </label>
              <label>Radius (m)
                <input value={editing.radius_meters ?? 50} onChange={(e) => setEditing(prev => ({ ...prev, radius_meters: e.target.value }))} />
              </label>

              <div style={{ marginTop: 12 }}>
                <h5>Fragen</h5>
                <div style={{ marginBottom: 8 }}>
                  <button type="button" onClick={addQuestionToEditing}>+ Frage hinzufügen</button>
                </div>

                {(editing.questions || []).map((q) => (
                  <div key={q.id} className="question-item" style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Frage</strong>
                      <div>
                        <button type="button" onClick={() => deleteQuestionFromEditing(q.id)}>Löschen</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <input placeholder="Frage..." value={q.question || ""} onChange={(e) => updateQuestionField(q.id, { question: e.target.value })} style={{ width: "100%" }} />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <strong>Antworten</strong>
                      <div>
                        {(q.answers || []).map((a, idx) => (
                          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                            <input value={a} onChange={(e) => {
                              const newAnswers = (q.answers || []).slice();
                              newAnswers[idx] = e.target.value;
                              updateQuestionField(q.id, { answers: newAnswers });
                            }} style={{ flex: 1 }} />
                            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="radio" name={`correct-${q.id}`} checked={q.correct_answer_idx === idx} onChange={() => setCorrectAnswer(q.id, idx)} />
                              richtig
                            </label>
                            <button type="button" onClick={() => removeAnswer(q.id, idx)} disabled={(q.answers || []).length <= 1}>−</button>
                          </div>
                        ))}
                        <div style={{ marginTop: 6 }}>
                          <button type="button" onClick={() => addAnswer(q.id)}>+ Antwort</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel-actions" style={{ marginTop: 12 }}>
                <button type="submit" disabled={saving}>Speichern</button>
                <button type="button" onClick={cancelEditing}>Abbrechen</button>
              </div>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}