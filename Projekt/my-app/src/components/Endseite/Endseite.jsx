import React, { useEffect, useState } from "react";
import { useParams } from 'react-router-dom';
import MapBackground from "../MapBackground";
import "./Endseite.css";
import Leaderboard from "./Leaderboard";
import UserEntry from "./UserEntry";

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";

export default function Endseite() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userTeamId, setUserTeamId] = useState(0);
  const [userEntry, setUserEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const { roomCode, groupName } = useParams();
  const [sessionId, setSessionId] = useState(null);
  const [ceremony, setCeremony] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // load sessiongroups and group names
        const sgUrl = `${API_BASE}/api/sessiongroups${roomCode ? `?roomCode=${encodeURIComponent(roomCode)}` : ''}`;
        const [sgRes, gnRes] = await Promise.all([
          fetch(sgUrl),
          fetch(`${API_BASE}/api/group-names`)
        ]);
        if (!sgRes.ok) throw new Error("Could not load sessiongroups");
        if (!gnRes.ok) throw new Error("Could not load group names");

        const sessiongroups = await sgRes.json(); // expects array
        const gnBody = await gnRes.json(); // { groupNames: [...] }

        // sessiongroups endpoint returns array -> if wrapped, adapt accordingly
        const sgs = Array.isArray(sessiongroups) ? sessiongroups : (sessiongroups.sessiongroups || []);
        const groupNamesArr = Array.isArray(gnBody) ? gnBody : (gnBody.groupNames || []);

        const nameMap = {};
        groupNamesArr.forEach(g => { nameMap[g.group_id ?? g.id] = g.group_name ?? g.name ?? g.groupName; });

        // try to map the current user's groupName (from URL) to a group_id for highlighting
        if (groupName) {
          const lower = String(groupName).toLowerCase();
          let myId = null;
          for (const [id, name] of Object.entries(nameMap)) {
            if (String(name || '').toLowerCase() === lower) { myId = Number(id); break; }
          }
          if (mounted && myId != null) setUserTeamId(myId);
        }

        // choose latest session (highest session_id)
        const maxSessionId = sgs.reduce((m, s) => (s.session_id > m ? s.session_id : m), 0);
        const currentSessionId = maxSessionId || (sgs[0] && sgs[0].session_id) || null;
        if (mounted) setSessionId(currentSessionId);

        // build leaderboard for that session
        const filtered = currentSessionId != null ? sgs.filter(s => Number(s.session_id) === Number(currentSessionId)) : sgs;
        // sort by points desc
        filtered.sort((a, b) => (Number(b.points || 0) - Number(a.points || 0)));

        const lb = filtered.map((g, idx) => ({
          id: g.group_id,
          name: nameMap[g.group_id] || `Team ${g.group_id}`,
          points: Number(g.points || 0),
        }));

        // ensure "Kein Team" fallback if empty
        if (lb.length === 0) lb.push({ id: 0, name: "Kein Team", points: 0 });

        if (mounted) setLeaderboard(lb);
      } catch (err) {
        console.error("Error loading leaderboard data:", err);
        if (mounted) setLeaderboard([{ id: 0, name: "Kein Team", points: 0 }]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [roomCode, groupName]);

  // poll ceremony status (in-memory flag; no DB)
  useEffect(() => {
    let timer = null;
    let cancelled = false;
    async function check() {
      if (!roomCode) return;
      try {
        const res = await fetch(`${API_BASE}/api/page/adminendseite/ceremony-status?roomCode=${encodeURIComponent(roomCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCeremony(!!data.ceremony);
        }
      } catch (e) {
        // ignore
      }
    }
    check();
    timer = setInterval(check, 5000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [roomCode]);

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
        <h1 className="endseite-headline">
          Glückwunsch zum Abschluss der Stadtrallye 🎉
        </h1>

        {loading ? (
          <div>Lade Rangliste…</div>
        ) : ceremony ? (
          <div className="endseite-leaderboard-wrapper">
            <Leaderboard leaderboard={leaderboard} userTeamId={userTeamId} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#333', marginTop: 12 }}>
            Warte bis der Spielleiter die Rallye beendet
          </div>
        )}

        {userEntry && (
          <UserEntry
            userEntry={userEntry}
            position={leaderboard.findIndex((t) => t.id === userTeamId) + 1}
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
}
