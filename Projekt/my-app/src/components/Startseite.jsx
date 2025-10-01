// src/components/Startseite.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from './LoginModal';
import MapBackground from './MapBackground';
import loginIcon from '../assets/login.svg';

const Startseite = () => {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <MapBackground />
      <span 
        className="login-icon" 
        aria-label="Login" 
        onClick={() => setShowLogin(true)} 
        style={{ cursor: 'pointer' }}
      >
        <img src={loginIcon} alt="Login" style={{ width: 40, height: 40 }} />
      </span>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <div>
        <h2>Willkommen zur Stadtrallye!</h2>
        <p>Starte hier deine Rallye und entdecke die Stadt.</p>
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
