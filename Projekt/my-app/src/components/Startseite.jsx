// src/components/Startseite.jsx
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import React, { useState } from 'react';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';

const Startseite = ({ onLogin }) => {
  const [showLogin, setShowLogin] = useState(false);

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
      </div>
    </>
  );
};

export default Startseite;