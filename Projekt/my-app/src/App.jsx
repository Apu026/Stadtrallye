import './App.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Startseite from './components/Startseite';
import Spielseite from './components/Spielseite';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Startseite />} />
        <Route path="/spiel" element={<Spielseite />} />
      </Routes>
    </Router>
  );
}

export default App;
