import React, { useState } from 'react'; // um aktuelle Einngabegelder zu speichern
import { useNavigate } from 'react-router-dom'; // für die Seiten-Navigation
import './ClosedSessionLogin.css'; // Stylesheet für das Login-Fenster


const ClosedSessionLogin = ({ onLogin }) => {  
  const [username, setUsername] = useState(''); // Eingabefeld für Benutzername
  const [password, setPassword] = useState(''); // Eingabefeld für Passwort
  const navigate = useNavigate();

  const handleSubmit = (e) => { // Funktion zum Absenden des Formulars
    e.preventDefault(); // Verhindert dass, die Seite neu geladen wird
    // Dummy-Login, akzeptiert alles
    onLogin(); 
    navigate('/startseite'); // Wechsel zur Startseite
  };

  return (
    <div className="closed-session-login-bg">
      <div className="closed-session-login-box">
        <h2 className="closed-session-login-title">Login</h2>
        <form onSubmit={handleSubmit} className="closed-session-login-form">
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="closed-session-login-input"/> 

          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="closed-session-login-input"/>
            
          <button type="submit" className="closed-session-login-button">
            Anmelden
          </button>
        </form>
      </div>
    </div>
  );
};


export default ClosedSessionLogin;
