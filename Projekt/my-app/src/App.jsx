import './App.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
 
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Simple protected route wrapper: checks login and optional roles
  const ProtectedRoute = ({ element, roles }) => {
    const roleOk = !roles || roles.length === 0 || roles.includes(userRole);
    if (isLoggedIn && roleOk) return element;
    return (
      <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />
    );
  };
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />} />
        <Route
          path="/startseite"
          element={
            isLoggedIn
              ? <Startseite onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />
              : <ClosedSessionLogin onLogin={(data) => { setIsLoggedIn(true); setUserRole(data?.role); }} />
          }
        />
        <Route path="/superadmin" element={<ProtectedRoute roles={["superadmin"]} element={<SuperadminPage />} />} />
        <Route path="/admin" element={<ProtectedRoute roles={["admin"]} element={<AdminPage />} />} />
        <Route path="/admin/poi-erstellen" element={<ProtectedRoute roles={["admin"]} element={<POIErstellen />} />} />
        <Route path="/admin/live/:roomCode?" element={<ProtectedRoute roles={["admin"]} element={<AdminLiveMap />} />} />
        <Route path="/group-select/:roomCode" element={<GroupSelect />} />
        <Route path="/waiting-room/:roomCode/:groupName" element={<WaitingRoom />} />
  <Route path="/spiel/:roomCode/:groupName" element={<Spielseite />} />
  <Route path="/endseite/:roomCode/:groupName" element={<Endseite />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;
