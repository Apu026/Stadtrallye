// src/components/Startseite.jsx


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';
import './Startseite.css';

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
      >
        <img src={loginIcon} alt="Login" />
      </span>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={onLogin} />}

      <div className="start-card">
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>

        <form onSubmit={handleJoin} className="start-form">
          <label htmlFor="roomCode">Raum-Code eingeben:</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            className="start-input"
            maxLength={12}
            required
          />
          {error && <div className="start-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="start-submit"
          >
            {loading ? 'Überprüfe...' : 'Beitreten'}
          </button>
        </form>
      </div>
    </>
  );
};

export default Startseite;
