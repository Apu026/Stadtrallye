// src/components/Startseite.jsx


import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';



const Startseite = ({ onLogin }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    // Prüfe, ob der Raum existiert (API-Call)
    try {
      const res = await fetch(`http://localhost:5000/api/rooms/check/${roomCode}`);
      const data = await res.json();
      if (res.ok && data.exists) {
        navigate(`/group-select/${roomCode}`);
      } else {
        setError('Raum nicht gefunden oder nicht offen');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };

  return (
    <>
      <MapBackground />
      <span className="login-icon" aria-label="Login" onClick={() => setShowLogin(true)} style={{ cursor: 'pointer' }}>
        <img src={loginIcon} alt="Login" style={{ width: 40, height: 40 }} />
      </span>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={onLogin} />}
      <div>
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>
        <form onSubmit={handleJoin} style={{ marginTop: 32, maxWidth: 350 }}>
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
            style={{
              width: '100%',
              padding: 10,
              fontSize: 18,
              borderRadius: 6,
              background: '#083163',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
          >
            Beitreten
          </button>
        </form>
      </div>
    </>
  );
};

export default Startseite;