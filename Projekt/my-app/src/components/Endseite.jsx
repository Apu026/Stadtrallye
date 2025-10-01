import React, { useEffect, useState } from "react";
import MapBackground from "./MapBackground";
import "./Endseite.css";

export default function Endseite() {
  const [leaderboard, setLeaderboard] = useState([
    { id: 1, name: "Team Alpha", points: 120 },
    { id: 2, name: "Team Beta", points: 110 },
    { id: 3, name: "Team Gamma", points: 95 },
    { id: 4, name: "Team Delta", points: 85 },
    { id: 5, name: "Team Epsilon", points: 75 },
    { id: 0, name: "Kein Team", points: 0 },
  ]);

  const [userTeamId, setUserTeamId] = useState(6);
  const [userEntry, setUserEntry] = useState(null);

  useEffect(() => {
    const entry = leaderboard.find((t) => t.id === userTeamId);
    setUserEntry(entry);
  }, [userTeamId, leaderboard]);

  return (
    <div className="endseite-root">
      <div className="endseite-map-bg">
        <MapBackground />
      </div>
      <div className="endseite-content">
        <div className="endseite-team-select">
          <label htmlFor="teamSelect">Aktuelles Team:</label>
          <select
            id="teamSelect"
            value={userTeamId}
            onChange={(e) => setUserTeamId(Number(e.target.value))}
          >
            {leaderboard.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <h1 className="endseite-headline">
          Glückwunsch zum Abschluss der Stadtrallye 🎉
        </h1>
        <div className="endseite-leaderboard">
          <h2>Top 5 Teams</h2>
          <ul>
            {leaderboard.slice(0, 5).map((team, i) => (
              <li
                key={team.id}
                className={
                  team.id === userTeamId
                    ? "endseite-leaderboard-item active"
                    : "endseite-leaderboard-item"
                }
              >
                <span>
                  {i + 1}. {team.name}
                </span>
                <span>{team.points} Punkte</span>
              </li>
            ))}
          </ul>
        </div>
        {userEntry && (
          <div className="endseite-user-entry">
            <h2>Dein Team: {userEntry.name}</h2>
            <p>
              Platz: {leaderboard.findIndex((t) => t.id === userTeamId) + 1}
            </p>
            <p>Punkte: {userEntry.points}</p>
          </div>
        )}
      </div>
    </div>
  );
}
