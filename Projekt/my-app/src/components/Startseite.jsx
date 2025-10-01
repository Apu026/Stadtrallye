// src/components/Startseite.jsx
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import React, { useState } from 'react';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';

const Startseite = ({ onShowEndseite }) => {
  const [showLogin, setShowLogin] = useState(false);
  return (
    <>
      <MapBackground />
      <span className="login-icon" aria-label="Login" onClick={() => setShowLogin(true)} style={{ cursor: 'pointer' }}>
  <img src={loginIcon} alt="Login" style={{ width: 40, height: 40 }} />
      </span>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <div>
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>
        {/* Button zur Endseite */}
        <button
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            borderRadius: 8,
            background: '#646cff',
            color: '#fff',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
          onClick={onShowEndseite}
        >
          Zur Endseite
        </button>
      </div>
    </>
  );
};

export default Startseite;