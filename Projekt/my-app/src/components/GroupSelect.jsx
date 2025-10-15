import React, { useState, useEffect } from 'react';
import './GroupSelect.css';
import { useNavigate, useParams } from 'react-router-dom';

const GroupSelect = () => {
  const { roomCode } = useParams();
  const [groupNames, setGroupNames] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [error, setError] = useState('');
  const [takenGroups, setTakenGroups] = useState([]);
  const navigate = useNavigate();

  // Fisher-Yates Shuffle
  const shuffleArray = (array) => {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  useEffect(() => {
    // Alle Gruppennamen laden
  fetch('/api/group-names')
      .then(res => res.json())
      .then(data => setGroupNames(shuffleArray(data.groupNames || [])))
      .catch(() => setError('Fehler beim Laden der Gruppennamen'));

    // Bereits vergebene Gruppen im Raum laden
  fetch(`/api/rooms/${roomCode}/taken-groups`)
      .then(res => res.json())
      .then(data => setTakenGroups(data.takenGroups || []))
      .catch(() => {});
  }, [roomCode]);

  const handleSelect = (name) => {
    if (!takenGroups.includes(name.group_name)) {
      setSelectedGroup(name.group_name);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroup) {
      setError('Bitte Gruppennamen wählen');
      return;
    }

    try {
  const res = await fetch(`/api/rooms/${roomCode}/join-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName: selectedGroup })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Fehler beim Beitreten zur Gruppe');
        return;
      }

      navigate(`/waiting-room/${roomCode}/${selectedGroup}`);
    } catch (err) {
      setError('Server nicht erreichbar');
    }
  };

  return (
    <div className="groupselect-bg">
      <h2>Gruppennamen wählen</h2>
      <form onSubmit={handleSubmit}>
        <div className="groupselect-grid">
          {groupNames.map((group, idx) => {
            const isTaken = takenGroups.includes(group.group_name);
            const isSelected = selectedGroup === group.group_name;
            let btnClass = 'groupselect-btn';
            if (isTaken) btnClass += ' taken';
            if (isSelected) btnClass += ' selected';
            // Nutze group_id, dann group_name, dann Index als Fallback für key
            const key = group.group_id || group.group_name || idx;
            return (
              <button
                key={key}
                type="button"
                onClick={() => !isTaken && handleSelect(group.group_name)}
                disabled={isTaken}
                className={btnClass}
              >
                {group.group_name}
              </button>
            );
          })}
        </div>

        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 16,
            fontSize: 22,
            borderRadius: 12,
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            marginTop: 8,
            fontWeight: 700,
            letterSpacing: 1
          }}
        >
          Weiter
        </button>
      </form>
    </div>
  );
};

export default GroupSelect;
