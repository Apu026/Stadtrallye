
// React und CSS importieren
import React, { useState, useEffect } from 'react';
import './AdminPage.css';

// Admin-Oberfläche für Räume und Rallyes
const AdminPage = () => {
  // State für Räume, Rallyes, Auswahl, Status und Meldungen
  const [rooms, setRooms] = useState([]);         // Liste der offenen Räume
  const [rallyes, setRallyes] = useState([]);     // Liste der Rallyes
  const [rallyeId, setRallyeId] = useState('');   // Ausgewählte Rallye
  const [creating, setCreating] = useState(false);// Wird gerade ein Raum erstellt?
  const [error, setError] = useState('');         // Fehlermeldung
  const [success, setSuccess] = useState('');     // Erfolgsmeldung

  // Holt alle Rallyes vom Server
  const fetchRallyes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/rallyes');
      const data = await res.json();
      setRallyes(data.rallyes || []);
      if (data.rallyes && data.rallyes.length > 0) setRallyeId(data.rallyes[0].id);
    } catch (err) {
      setError('Fehler beim Laden der Rallyes');
    }
  };

  // Holt alle offenen Räume vom Server
  const fetchRooms = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
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
      const res = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rallye_id: rallyeId })
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setSuccess(`Raum erstellt! Code: ${data.room.code}`);
        setRooms([data.room, ...rooms]);
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
      const res = await fetch(`http://localhost:5000/api/rooms/${roomId}/close`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setRooms(rooms.filter(r => r.id !== roomId));
        setSuccess('Raum geschlossen');
      } else {
        setError(data.error || 'Fehler beim Schließen des Raums');
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
        {rooms.length === 0 && <div>Keine offenen Räume.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rooms.map(room => (
            <li key={room.id} style={{ marginBottom: 18, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              {/* Raumdaten */}
              <span style={{ fontWeight: 600, fontSize: 18 }}>Code: {room.code}</span>
              <span style={{ marginLeft: 16, color: '#555', fontSize: 15 }}>Status: {room.status}</span>
              <span style={{ marginLeft: 16, color: '#888', fontSize: 15 }}>Rallye-ID: {room.rallye_id}</span>
              {/* Button zum Schließen */}
              <button style={{ marginLeft: 24, background: '#e53935', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 15 }} onClick={() => handleCloseRoom(room.id)}>
                Raum schließen
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

}

export default AdminPage;
