import React from "react";

export default function TeamSelect({ leaderboard, userTeamId, onChange }) {
  return (
    <div className="endseite-team-select" role="group" aria-label="Team auswählen">
      <label htmlFor="teamSelect">Aktuelles Team:</label>
      <select
        id="teamSelect"
        value={userTeamId}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {leaderboard.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );
}