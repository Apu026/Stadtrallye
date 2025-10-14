import React, { useEffect, useState } from "react";
import AdminMapEditor from "./AdminMapEditor";
import "./AdminSpielseite.css";

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "http://localhost:4000";

export default function AdminSpielseite() {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // local edit copy
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    const tmp = { id: tmpId, name, lat, lng, radius_meters };
    setPois(prev => [tmp, ...prev]);
    setSelected(tmp);
    setEditing({ ...tmp });
    return tmp;
  };

  // update only local state (used for input changes and marker drag)
  const updateLocalPoi = (id, changes) => {
    setPois(prev => prev.map(p => (String(p.id) === String(id) ? { ...p, ...changes } : p)));
    if (editing && String(editing.id) === String(id)) setEditing(prev => ({ ...prev, ...changes }));
    if (selected && String(selected.id) === String(id)) setSelected(prev => ({ ...prev, ...changes }));
  };

  // save local editing to server (POST if tmp, PUT if existing)
  const saveEditingPoi = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        name: editing.name,
        lat: Number(editing.lat),
        lng: Number(editing.lng),
        radius_meters: Number(editing.radius_meters || 50)
      };

      if (String(editing.id).startsWith("tmp-")) {
        const res = await fetch(`${API_BASE}/api/pois`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("create failed");
        const created = await res.json();
        setPois(prev => prev.map(p => (String(p.id) === String(editing.id) ? created : p)));
        setSelected(created);
        setEditing(created);
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
        setEditing(updated);
      }
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
      // revert editing to current pois state
      const original = pois.find(p => String(p.id) === String(editing.id));
      if (original) setSelected(original);
    }
    setEditing(null);
    setSelected(null);
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
        /* onCreateLocal entfernt: Karte erzeugt keine POIs mehr beim Klick */
        onSelect={(p) => { setSelected(p); setEditing({ ...p }); }}
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
              <div className="poi-info" onClick={() => { setSelected(p); setEditing({ ...p }); }}>
                <strong>{p.name}</strong>
                <div className="small">{p.lat?.toFixed?.(5)} , {p.lng?.toFixed?.(5)}</div>
              </div>
              <div className="poi-actions">
                <button onClick={() => { setSelected(p); setEditing({ ...p }); }}>Bearbeiten</button>
                <button onClick={() => deletePoi(p.id)}>Löschen</button>
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
                <input value={editing.lat ?? ""} onChange={(e) => { setEditing(prev => ({ ...prev, lat: e.target.value })); }} />
              </label>
              <label>Lng
                <input value={editing.lng ?? ""} onChange={(e) => { setEditing(prev => ({ ...prev, lng: e.target.value })); }} />
              </label>
              <label>Radius (m)
                <input value={editing.radius_meters ?? 50} onChange={(e) => setEditing(prev => ({ ...prev, radius_meters: e.target.value }))} />
              </label>

              <div className="panel-actions">
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