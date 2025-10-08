import React from 'react';
import './AdminPage.css';

const AdminPage = () => {
  return (
    <div className="admin-page-container">
      <h2 className="admin-page-title">Admin-Bereich</h2>
      <p className="admin-page-desc">Willkommen! Hier kannst du einen neuen Raum für die Stadtrallye erstellen.</p>
      {/* Hier später: Raum erstellen, Gruppen überwachen, usw. */}
      <button className="admin-page-create-btn">
        Raum erstellen
      </button>
    </div>
  );
};

export default AdminPage;
