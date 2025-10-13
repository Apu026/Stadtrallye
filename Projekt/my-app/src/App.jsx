import './App.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

import Startseite from './components/Startseite';
import ClosedSessionLogin from './components/ClosedSessionLogin';
import SuperadminPage from './components/SuperadminPage';
import AdminPage from './components/AdminPage';
import GroupSelect from './components/GroupSelect';
import WaitingRoom from './components/WaitingRoom';
import Spielseite from './components/Spielseite';
 
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
  <Route path="/startseite" element={isLoggedIn ? <Startseite onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} /> : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
        <Route path="/superadmin" element={<SuperadminPage />} />
        <Route path="/admin" element={isLoggedIn && userRole === 'admin' ? <AdminPage /> : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
        <Route path="/group-select/:roomCode" element={<GroupSelect />} />
        <Route path="/waiting-room/:roomCode/:groupName" element={<WaitingRoom />} />
        <Route path="/spiel/:roomCode/:groupName" element={<Spielseite />} />
      </Routes>
    </BrowserRouter>
  );
}
 
export default App;