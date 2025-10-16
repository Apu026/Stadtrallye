import React, { useState } from 'react';
import './LoginModal.css';
import { useNavigate } from 'react-router-dom';
const LoginModal = ({ onClose, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
  const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok && data.success && data.role === 'superadmin') {
        if (onLogin) onLogin(data);
        onClose();
        navigate('/superadmin');
      } else if (response.ok && data.success && (data.role === 'admin')) {
        if (onLogin) onLogin(data);
        onClose();
        navigate('/admin');
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
    <div className="login-modal-overlay">
      <div className="login-modal">
        <button className="login-modal-close" onClick={onClose}>&times;</button>
        <h2>Anmelden</h2>
        <form onSubmit={handleLogin}>
          {error && <div className="login-modal-error">{error}</div>}
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
