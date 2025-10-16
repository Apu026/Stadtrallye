import './App.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Startseite from './components/Startseite';
import ClosedSessionLogin from './components/ClosedSessionLogin';
import SuperadminPage from './components/SuperadminPage';
import AdminPage from './components/AdminPage';
import POIErstellen from './components/AdminSpielseite/POI-erstellen';
import AdminLiveMap from './components/AdminSpielseite/AdminLiveMap';
import GroupSelect from './components/GroupSelect';
import WaitingRoom from './components/WaitingRoom';
import Spielseite from './components/Spielseite';
import Endseite from './components/Endseite/Endseite';
import AdminEndseite from './components/Endseite/AdminEndseite';
 
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
  <Route path="/admin/poi-erstellen" element={isLoggedIn && userRole === 'admin' ? <POIErstellen /> : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
  <Route path="/admin/live/:roomCode?" element={isLoggedIn && userRole === 'admin' ? <AdminLiveMap /> : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
        <Route path="/group-select/:roomCode" element={<GroupSelect />} />
        <Route path="/waiting-room/:roomCode/:groupName" element={<WaitingRoom />} />
  <Route path="/spiel/:roomCode/:groupName" element={<Spielseite />} />
  <Route path="/endseite/:roomCode/:groupName" element={<Endseite />} />
  <Route path="/admin/end/:roomCode" element={isLoggedIn && userRole === 'admin' ? <AdminEndseite /> : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;
