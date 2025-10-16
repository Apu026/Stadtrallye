import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './WaitingRoom.css';
import useBackBlocker from '../hooks/useBackBlocker';

const WaitingRoom = () => {
  useBackBlocker('Bitte nicht zurück – warte auf den Start der Rallye.', '/startseite');
  const { roomCode, groupName } = useParams();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const [rallyeName, setRallyeName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let rallyeId = null;

    const fetchRoomAndRallye = async () => {
      try {
  const res = await fetch(`/api/rooms/check/${roomCode}`);
        const data = await res.json();

        if (!res.ok) {
          setError('Serverfehler beim Prüfen des Raums');
          return;
        }

        if (!data.exists) {
          setError('Raum existiert nicht oder ist nicht offen');
          return;
        }

        // Raum existiert
        rallyeId = Number(data.rallye_id);

        if (!rallyeId) {
          setError('Rallye-ID fehlt für diesen Raum');
        } else {
          // Hole Rallye-Namen
          const rallyeRes = await fetch(`/api/rallyes`);
          const rallyeData = await rallyeRes.json();
          if (rallyeRes.ok && rallyeData.rallyes) {
            const rallye = rallyeData.rallyes.find(r => Number(r.id) === rallyeId);
            if (rallye) setRallyeName(rallye.name);
          }
          // Prüfe Status
          const status = data.status || (data.room && data.room.status);
          if (status === 'gestartet') {
            setStarted(true);
            navigate(`/spiel/${roomCode}/${groupName}?rallye_id=${rallyeId}`, { replace: true });
          } else {
            setStarted(false);
            setError('Warten auf Start der Rallye...');
          }
        }
      } catch (err) {
        console.error(err);
        setError('Fehler beim Prüfen des Raums');
      }
    };

    fetchRoomAndRallye();
    const interval = setInterval(fetchRoomAndRallye, 3000);
    return () => clearInterval(interval);
  }, [roomCode, groupName, navigate]);

  return (
    <div className="waitingroom-bg">
      <div className="waitingroom-container">
        <div className="waitingroom-title">Warten auf Start…</div>
        <div className="waitingroom-info">
          {rallyeName && <>Rallye: <b>{rallyeName}</b><br /></>}
          Gruppenname: <b>{groupName}</b><br />
          Raum-Code: <b>{roomCode}</b>
        </div>
        <div className="waitingroom-info">Bitte warten, bis der Admin die Rallye startet.</div>
        <div className="waitingroom-spinner" />
        {error && <div style={{ color: error.includes('Fehler') ? 'red' : 'orange', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
};

export default WaitingRoom;
