// React und CSS importieren
import React, { useState, useEffect } from 'react';
import './AdminPage.css';

// Admin-Oberfläche für Räume und Rallyes
const AdminPage = () => {
  // State für Räume, Rallyes, Auswahl, Status und Meldungen
  const [rooms, setRooms] = useState([]);         // Alle Räume
  const [openRooms, setOpenRooms] = useState([]); // Offene Räume
  const [closedRooms, setClosedRooms] = useState([]); // Geschlossene Räume
  const [rallyes, setRallyes] = useState([]);     // Liste der Rallyes
  const [rallyeId, setRallyeId] = useState('');   // Ausgewählte Rallye
  const [creating, setCreating] = useState(false);// Wird gerade ein Raum erstellt?
  const [error, setError] = useState('');         // Fehlermeldung
  const [success, setSuccess] = useState('');     // Erfolgsmeldung
  const [startedRooms, setStartedRooms] = useState([]); // Gestartete Räume

  // Holt alle Rallyes vom Server
  const fetchRallyes = async () => {
    try {
  const res = await fetch('/api/rallyes');
      const data = await res.json();
      setRallyes(data.rallyes || []);
      if (data.rallyes && data.rallyes.length > 0) setRallyeId(data.rallyes[0].id);
    } catch (err) {
      setError('Fehler beim Laden der Rallyes');
    }
  };


  // Holt alle Räume (offen und geschlossen) vom Server
  const fetchRooms = async () => {
    try {
  const res = await fetch('/api/rooms/all');
      const data = await res.json();
      setRooms(data.rooms || []);
      setOpenRooms((data.rooms || []).filter(r => r.status === 'offen'));
      setClosedRooms((data.rooms || []).filter(r => r.status === 'geschlossen'));
      setStartedRooms((data.rooms || []).filter(r => r.status === 'gestartet'));
    } catch (err) {
      setError('Fehler beim Laden der Räume');
    }
  };

  // Lädt Rallyes und Räume beim ersten Laden der Seite
  useEffect(() => {
    fetchRallyes();
    fetchRooms();
  }, []);

  // Erstellt einen neuen Raum für die ausgewählte Rallye
  const handleCreateRoom = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
  const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rallye_id: rallyeId })
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setSuccess(`Raum erstellt! Code: ${data.room.code}`);
        fetchRooms(); // Nach dem Erstellen neu laden
      } else {
        setError(data.error || 'Fehler beim Erstellen des Raums');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
    setCreating(false);
  };

  // Schließt einen Raum (setzt Status auf "geschlossen")
  const handleCloseRoom = async (roomId) => {
    setError('');
    setSuccess('');
    try {
  const res = await fetch(`/api/rooms/${roomId}/close`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.room) {
        fetchRooms(); // Nach dem Schließen neu laden
        setSuccess('Raum geschlossen');
      } else {
        setError(data.error || 'Fehler beim Schließen des Raums');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };

  // Löscht einen Raum endgültig
  const handleDeleteRoom = async (roomId) => {
    setError('');
    setSuccess('');
    if (!window.confirm('Soll dieser Raum wirklich gelöscht werden?')) return;
    try {
  const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchRooms(); // Nach dem Löschen neu laden
        setSuccess('Raum gelöscht');
      } else {
        setError(data.error || 'Fehler beim Löschen des Raums');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };

  // Startet eine Rallye (setzt Status auf 'gestartet')
  const handleStartRoom = async (roomId) => {
    setError('');
    setSuccess('');
    try {
  const res = await fetch(`/api/rooms/${roomId}/start`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.room) {
        fetchRooms(); // Nach dem Starten neu laden
        setSuccess('Rallye gestartet');
      } else {
        setError(data.error || 'Fehler beim Starten der Rallye');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };  

  // Das UI der Admin-Seite
  return (
    <div className="admin-page-container">
      {/* Überschrift und Beschreibung */}
      <h2 className="admin-page-title">Admin-Bereich</h2>
      <p className="admin-page-desc">Willkommen! Hier kannst du einen neuen Raum für die Stadtrallye erstellen.</p>

      {/* Dropdown für Rallye-Auswahl */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="rallye-select" style={{ fontWeight: 500, marginRight: 8 }}>Stadtrallye wählen:</label>
        <select id="rallye-select" value={rallyeId} onChange={e => setRallyeId(e.target.value)} style={{ fontSize: 16, padding: '6px 12px', borderRadius: 6 }}>
          {rallyes.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>

      {/* Fehler- und Erfolgsmeldungen */}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: 12 }}>{success}</div>}

      {/* Button zum Erstellen eines Raums */}
      <button className="admin-page-create-btn" onClick={handleCreateRoom} disabled={creating}>
        {creating ? 'Erstelle...' : 'Raum erstellen'}
      </button>

      {/* Liste der offenen Räume */}
      <div style={{ marginTop: 36 }}>
        <h3>Offene Räume</h3>
        {openRooms.length === 0 && <div>Keine offenen Räume.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {openRooms.map(room => (
            <li key={room.id} style={{ marginBottom: 18, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              {/* Raumdaten */}
              <span style={{ fontWeight: 600, fontSize: 18 }}>Code: {room.code}</span>
              <span style={{ marginLeft: 16, color: '#555', fontSize: 15 }}>Status: {room.status}</span>
              <span style={{ marginLeft: 16, color: '#888', fontSize: 15 }}>
                Rallye: {rallyes.find(r => r.id === room.rallye_id)?.name || room.rallye_id}
              </span>
              {/* Button zum Starten */}
              <button className="admin-page-action-btn admin-page-start-btn" onClick={() => handleStartRoom(room.id)}>
                Rallye starten
              </button>
              {/* Button zum Schließen */}
              <button className="admin-page-action-btn admin-page-close-btn" onClick={() => handleCloseRoom(room.id)}>
                Raum schließen
              </button>
              {/* Button zum Löschen */}
              <button className="admin-page-action-btn admin-page-delete-btn" onClick={() => handleDeleteRoom(room.id)}>
                Raum löschen
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Liste der geschlossenen Räume */}
      <div style={{ marginTop: 36 }}>
        <h3>Geschlossene Räume</h3>
        {closedRooms.length === 0 && <div>Keine geschlossenen Räume.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {closedRooms.map(room => (
            <li key={room.id} style={{ marginBottom: 18, background: '#f3f3f3', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', opacity: 0.7 }}>
              {/* Raumdaten */}
              <span style={{ fontWeight: 600, fontSize: 18 }}>Code: {room.code}</span>
              <span style={{ marginLeft: 16, color: '#555', fontSize: 15 }}>Status: {room.status}</span>
              <span style={{ marginLeft: 16, color: '#888', fontSize: 15 }}>
                Rallye: {rallyes.find(r => r.id === room.rallye_id)?.name || room.rallye_id}
              </span>
              {/* Button zum Löschen */}
              <button className="admin-page-action-btn admin-page-delete-btn" onClick={() => handleDeleteRoom(room.id)}>
                Raum löschen
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Liste der gestarteten Räume */}
      <div style={{ marginTop: 36 }}>
        <h3>Gestartete Räume</h3>
        {startedRooms.length === 0 && <div>Keine gestarteten Räume.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {startedRooms.map(room => (
            <li key={room.id} style={{ marginBottom: 18, background: '#e6f7ff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', opacity: 0.95 }}>
              {/* Raumdaten */}
              <span style={{ fontWeight: 600, fontSize: 18 }}>Code: {room.code}</span>
              <span style={{ marginLeft: 16, color: '#555', fontSize: 15 }}>Status: {room.status}</span>
              <span style={{ marginLeft: 16, color: '#888', fontSize: 15 }}>
                Rallye: {rallyes.find(r => r.id === room.rallye_id)?.name || room.rallye_id}
              </span>
              {/* Button zum Löschen */}
              <button className="admin-page-action-btn admin-page-delete-btn" onClick={() => handleDeleteRoom(room.id)}>
                Raum löschen
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

}

export default AdminPage;
