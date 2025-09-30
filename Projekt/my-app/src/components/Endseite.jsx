import React from 'react'

function Endseite() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Herzlichen Glückwunsch!</h1>
      <p>Du hast die Stadtralye erfolgreich abgeschlossen.</p>
      <img
        src="/vite.svg"
        alt="Abschluss"
        style={{ width: 120, margin: '2rem auto' }}
      />
      <p>
        Vielen Dank fürs Mitmachen! <br />
        Wir hoffen, du hattest Spaß und konntest etwas Neues entdecken.
      </p>
      <a href="/" style={{ color: '#646cff', textDecoration: 'underline' }}>
        Zurück zur Startseite
      </a>
    </div>
  )
}

export default Endseite