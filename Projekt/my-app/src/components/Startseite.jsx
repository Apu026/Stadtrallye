// src/components/Startseite.jsx


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';

const Startseite = ({ onLogin }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // <-- Ladezustand
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    if (!roomCode) {
      setError('Bitte Raum-Code eingeben');
      return;
    }

    setLoading(true); // Start Ladezustand
    try {
  const res = await fetch(`/api/rooms/check/${roomCode}`);
      if (!res.ok) {
        setError(`Serverfehler: ${res.status}`);
        return;
      }

      const data = await res.json();
      console.log('Response von /api/rooms/check:', data);

      if (data.exists && data.rallye_id) {
        navigate(`/group-select/${roomCode}`);
      } else if (data.exists && !data.rallye_id) {
        setError('Raum existiert, aber Rallye-ID fehlt');
      } else {
        setError('Raum nicht gefunden oder nicht offen');
      }
    } catch (err) {
      console.error('Fehler beim Prüfen des Raumcodes:', err);
      setError('Server nicht erreichbar');
    } finally {
      setLoading(false); // Ladezustand beenden
    }
  };

  return (
    <>
      <MapBackground />
      <span
        className="login-icon"
        aria-label="Login"
        onClick={() => setShowLogin(true)}
        style={{ cursor: 'pointer', position: 'absolute', top: 20, right: 20, zIndex: 1000 }}
      >
        <img src={loginIcon} alt="Login" style={{ width: 40, height: 40 }} />
      </span>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={onLogin} />}

      <div style={{ maxWidth: 400, margin: '80px auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>

        <form onSubmit={handleJoin} style={{ marginTop: 32 }}>
          <label htmlFor="roomCode">Raum-Code eingeben:</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: 10,
              margin: '12px 0',
              fontSize: 18,
              borderRadius: 6,
              background: '#fff',
              border: '1.5px solid #083163',
              color: '#222'
            }}
            maxLength={12}
            required
          />
          {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading} // <-- Button deaktiviert während Laden
            style={{
              width: '100%',
              padding: 10,
              fontSize: 18,
              borderRadius: 6,
              background: loading ? '#555' : '#083163',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              transition: 'background 0.2s',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Überprüfe...' : 'Beitreten'}
          </button>
        </form>

        <button
          onClick={() => navigate('/spiel')}
          style={{ padding: "10px 20px", marginTop: "10px", cursor: "pointer" }}
        >
          Zur Spielseite
        </button>
      </div>
    </>
  );
};

export default Startseite;
