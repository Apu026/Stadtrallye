import './App.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Startseite from './components/Startseite';
import ClosedSessionLogin from './components/ClosedSessionLogin';
import SuperadminPage from './components/SuperadminPage';
 
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClosedSessionLogin onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/startseite" element={isLoggedIn ? <Startseite /> : <ClosedSessionLogin onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/superadmin" element={<SuperadminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
 
export default App;