import React, { useState } from 'react';
import './LoginModal.css';
// Entferne useNavigate und Navigation
const LoginModal = ({ onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Beispielhafte Rollenlogik (später durch echten API-Call ersetzen)
    onClose();
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        <button className="login-modal-close" onClick={onClose}>&times;</button>
        <h2>Anmelden</h2>
        <form onSubmit={handleLogin}>
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
