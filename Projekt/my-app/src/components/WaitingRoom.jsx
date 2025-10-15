
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './WaitingRoom.css';

const WaitingRoom = () => {
  const { roomCode, groupName } = useParams();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const [rallyeName, setRallyeName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let rallyeId = null;
    // Polling: Prüfe alle 3 Sekunden, ob die Rallye gestartet wurde
    const fetchRoomAndRallye = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/rooms/code/${roomCode}`);
        const data = await res.json();
        if (res.ok && data.room) {
          rallyeId = data.room.rallye_id;
          // Hole Rallye-Namen
          if (rallyeId) {
            const rallyeRes = await fetch(`http://localhost:5000/api/rallyes`);
            const rallyeData = await rallyeRes.json();
            if (rallyeRes.ok && rallyeData.rallyes) {
              const rallye = rallyeData.rallyes.find(r => r.rallye_id === rallyeId);
              if (rallye) setRallyeName(rallye.name);
            }
          }
          if (data.room.status === 'gestartet') {
            setStarted(true);
            navigate(`/spiel/${roomCode}/${groupName}`);
          }
        }
      } catch (err) {
        setError('Fehler beim Prüfen des Raum-Status');
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
          {rallyeName && (<>
            Rallye: <b>{rallyeName}</b><br />
          </>)}
          Gruppenname: <b>{groupName}</b><br />
          Raum-Code: <b>{roomCode}</b>
        </div>
        <div className="waitingroom-info">Bitte warten, bis der Admin die Rallye startet.</div>
  <div className="waitingroom-spinner" />
  {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
};

export default WaitingRoom;
