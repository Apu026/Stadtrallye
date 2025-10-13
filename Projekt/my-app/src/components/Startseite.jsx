// src/components/Startseite.jsx
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import React, { useState } from 'react';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';

const Startseite = ({ onLogin, onShowEndseite }) => {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <MapBackground />
      <span className="login-icon" aria-label="Login" onClick={() => setShowLogin(true)} style={{ cursor: 'pointer' }}>
        <img src={loginIcon} alt="Login" style={{ width: 40, height: 40 }} />
      </span>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={onLogin} />}
      <div style={{ textAlign: 'center' }}>
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>

        {/* Button mittig unter dem Text, navigiert zur Endseite */}
        <div style={{ marginTop: '1rem' }}>
          <button
            onClick={() => onShowEndseite && onShowEndseite()}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: 8,
              background: '#646cff',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Zur Endseite
          </button>
        </div>
      </div>
    </>
  );
};

export default Startseite;