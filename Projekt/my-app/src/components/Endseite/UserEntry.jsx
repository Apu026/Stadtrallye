import React from "react";

export default function UserEntry({ userEntry, position }) {
  return (
    <div className="endseite-user-entry" role="status" aria-live="polite">
      <h2>Dein Team: {userEntry.name}</h2>
      <p>Platz: {position}</p>
      <p>Punkte: {userEntry.points}</p>
    </div>
  );
}