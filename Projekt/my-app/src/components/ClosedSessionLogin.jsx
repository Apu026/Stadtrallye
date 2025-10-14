import React, { useState } from 'react'; // um aktuelle Einngabegelder zu speichern
import { useNavigate } from 'react-router-dom'; // für die Seiten-Navigation
import './ClosedSessionLogin.css'; // Stylesheet für das Login-Fenster


const ClosedSessionLogin = ({ onLogin }) => {  
  const [username, setUsername] = useState(''); // Eingabefeld für Benutzername
  const [password, setPassword] = useState(''); // Eingabefeld für Passwort
  const navigate = useNavigate();

  const [error, setError] = useState('');

  const handleSubmit = async (e) => { // Funktion zum Absenden des Formulars
    e.preventDefault(); // Verhindert dass, die Seite neu geladen wird
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.role === 'closed') {
        if (onLogin) onLogin(data);
        navigate('/startseite');
      } else if (response.ok && data.success) {
        setError('Nur für Authorisierte Benutzer erlaubt!');
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };

  return (
    <div className="closed-session-login-bg">
      <div className="closed-session-login-box">
        <h2 className="closed-session-login-title">Login</h2>
        <form onSubmit={handleSubmit} className="closed-session-login-form">
          {error && <div className="closed-session-login-error">{error}</div>}
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
