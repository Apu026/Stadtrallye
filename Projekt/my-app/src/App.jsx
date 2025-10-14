import './App.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Startseite from './components/Startseite';
import Spielseite from './components/Spielseite';
import AdminSpielseite from './components/AdminSpielseite/AdminSpielseite';
import Endseite from './components/Endseite';

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);

  if (showAdmin) {
    return (
      <>
        {/* Zurück-Button oben links */}
        <button
          onClick={() => setShowAdmin(false)}
          style={{ position: 'fixed', left: 12, top: 12, zIndex: 2000 }}
          aria-label="Zurück zur Startseite"
        >
          ← Zurück
        </button>

        {/* Admin-Seite füllt den Rest */}
        <AdminSpielseite />
      </>
    );
  }

  return (
    <div className="App">
      {/* ...existing startpage content... */}
      <header>
        <h1>Startseite</h1>
      </header>

      <main>
        {/* Button öffnet Admin-Ansicht */}
        <button onClick={() => setShowAdmin(true)} aria-label="Admin öffnen">
          Admin öffnen
        </button>

        {/* ...restliche Startseiten-Inhalte... */}
      </main>
    </div>
  );
}
