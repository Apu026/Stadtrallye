import React from "react";

export default function Leaderboard({ leaderboard, userTeamId }) {
  return (
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
            <span className="team-name">
              {i + 1}. {team.name}
            </span>
            <span className="team-points">{team.points} Punkte</span>
          </li>
        ))}
      </ul>
    </div>
  );
}