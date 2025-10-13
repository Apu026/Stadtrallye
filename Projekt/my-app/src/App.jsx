import './App.css';
import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Startseite from './components/Startseite';
import Endseite from './components/Endseite/Endseite';

function StartseiteWithRouting() {
  const navigate = useNavigate();
  return <Startseite onShowEndseite={() => navigate('/endseite')} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartseiteWithRouting />} />
        <Route path="/endseite" element={<Endseite />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;