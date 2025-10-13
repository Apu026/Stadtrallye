import React, { useEffect, useState } from "react";
import MapBackground from "../MapBackground";
import "./Endseite.css";
import TeamSelect from "./TeamSelect";
import Leaderboard from "./Leaderboard";
import UserEntry from "./UserEntry";

export default function Endseite() {
  const [leaderboard, setLeaderboard] = useState([
    { id: 1, name: "Team Alpha", points: 120 },
    { id: 2, name: "Team Beta", points: 110 },
    { id: 3, name: "Team Gamma", points: 95 },
    { id: 4, name: "Team Delta", points: 85 },
    { id: 5, name: "Team Epsilon", points: 75 },
    { id: 0, name: "Kein Team", points: 0 },
  ]);

  const [userTeamId, setUserTeamId] = useState(0);
  const [userEntry, setUserEntry] = useState(null);

  useEffect(() => {
    const entry = leaderboard.find((t) => t.id === userTeamId) || null;
    setUserEntry(entry);
  }, [userTeamId, leaderboard]);

  return (
    <div className="endseite-root">
      <div className="endseite-map-bg">
        <MapBackground />
      </div>

      <div className="endseite-content">
        <TeamSelect
          leaderboard={leaderboard}
          userTeamId={userTeamId}
          onChange={setUserTeamId}
        />

        <h1 className="endseite-headline">
          Glückwunsch zum Abschluss der Stadtrallye 🎉
        </h1>

        <Leaderboard leaderboard={leaderboard} userTeamId={userTeamId} />

        {userEntry && (
          <UserEntry
            userEntry={userEntry}
            position={leaderboard.findIndex((t) => t.id === userTeamId) + 1}
          />
        )}
      </div>
    </div>
  );
}
