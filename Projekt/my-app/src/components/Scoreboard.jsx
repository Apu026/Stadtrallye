import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './Scoreboard.css';

// Lightweight scoreboard that polls backend for current session group points
// Props:
// - roomCode: session entry code
// - currentGroupName: the local player's group name (to exclude from list)
// - pollMs?: optional polling interval (default 5000ms)
export default function Scoreboard({ roomCode, currentGroupName, pollMs = 5000 }) {
  const [rows, setRows] = useState([]); // [{ group_id, points }]
  const [groups, setGroups] = useState([]); // [{ group_id, group_name }]
  const timerRef = useRef(null);

  // Load static group name map once
  useEffect(() => {
    let ignore = false;
    async function loadGroups() {
      try {
        const r = await fetch('/api/group-names');
        if (!r.ok) throw new Error('Failed to fetch group names');
        const data = await r.json();
        if (!ignore) setGroups(Array.isArray(data.groupNames) ? data.groupNames : []);
      } catch (e) {
        console.warn('[Scoreboard] group-names fetch failed:', e.message || e);
        if (!ignore) setGroups([]);
      }
    }
    loadGroups();
    return () => { ignore = true; };
  }, []);

  // Poll sessiongroups for the given roomCode
  useEffect(() => {
    if (!roomCode) return;
    let stopped = false;
    async function load() {
      try {
        const r = await fetch(`/api/sessiongroups?roomCode=${encodeURIComponent(roomCode)}`);
        if (!r.ok) throw new Error(`Failed to fetch sessiongroups: ${r.status}`);
        const data = await r.json();
        if (!stopped) setRows(Array.isArray(data.sessiongroups) ? data.sessiongroups : []);
      } catch (e) {
        console.warn('[Scoreboard] sessiongroups fetch failed:', e.message || e);
        if (!stopped) setRows([]);
      }
    }
    // initial load and interval
    load();
    timerRef.current = setInterval(load, Math.max(2000, pollMs));
    return () => {
      stopped = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomCode, pollMs]);

  const nameById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.group_id, g.group_name);
    return m;
  }, [groups]);

  const items = useMemo(() => {
    const selfName = (currentGroupName || '').trim();
    const selfNameLc = selfName.toLowerCase();
    // Try to resolve current group's ID from group names
    const gMatch = groups.find(g => (g.group_name || '').trim().toLowerCase() === selfNameLc);
    const selfId = gMatch?.group_id ?? null;

    // Map rows to display items
    let arr = rows.map(r => ({
      id: r.group_id,
      name: nameById.get?.(r.group_id) || `Gruppe #${r.group_id}`,
      points: Number(r.points) || 0,
    }));

    // Ensure self is present with at least 0 points
    const hasSelf = arr.some(it => (selfId != null ? it.id === selfId : it.name.trim().toLowerCase() === selfNameLc));
    if (!hasSelf && selfName) {
      arr.push({ id: selfId ?? `self-${selfName}`, name: selfName, points: 0 });
    }

    // Sort and dense-rank (ties share the same rank: 1,2,2,3,...)
    arr.sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));
    let lastPoints = null;
    let currentRank = 0;
    const ranked = arr.map((it) => {
      if (lastPoints === null || it.points !== lastPoints) {
        currentRank += 1;
        lastPoints = it.points;
      }
      return {
        ...it,
        rank: currentRank,
        isSelf: (selfId != null ? it.id === selfId : it.name.trim().toLowerCase() === selfNameLc)
      };
    });

    return ranked;
  }, [rows, nameById, currentGroupName, groups]);

  // Build final list: Top 5 + (self if outside top 5)
  const topN = 5;
  const topCount = Math.min(topN, items.length);
  const selfIdx = items.findIndex(i => i.isSelf);
  const selfOutsideTop = selfIdx >= topN && selfIdx !== -1;
  const itemsShown = React.useMemo(() => {
    const arr = [...items.slice(0, topCount)];
    if (selfOutsideTop) {
      arr.push({ __sep: true, key: 'sep' });
      arr.push(items[selfIdx]);
    }
    return arr;
  }, [items, topCount, selfIdx, selfOutsideTop]);

  // FLIP animation for ranking changes
  const rowRefs = useRef(new Map()); // key -> element
  const prevRectsRef = useRef(new Map()); // key -> DOMRect from previous render
  const prevRanksRef = useRef(new Map()); // key -> previous rank

  const setRowRef = (key) => (el) => {
    if (!key) return;
    const map = rowRefs.current;
    if (el) map.set(key, el); else map.delete(key);
  };

  useLayoutEffect(() => {
    // Build current rects
    const currRects = new Map();
    for (const it of itemsShown) {
      if (!it || it.__sep) continue;
      const el = rowRefs.current.get(it.id);
      if (el) currRects.set(it.id, el.getBoundingClientRect());
    }

    // Animate from previous rects to current
    for (const [key, curr] of currRects.entries()) {
      const prev = prevRectsRef.current.get(key);
      const el = rowRefs.current.get(key);
      if (!prev || !el) continue;
      const dx = prev.left - curr.left;
      const dy = prev.top - curr.top;
      if (dx !== 0 || dy !== 0) {
        el.style.transition = 'transform 420ms ease-in-out';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        // Force reflow, then reset to animate to new place
        void el.getBoundingClientRect();
        requestAnimationFrame(() => {
          const prevRank = prevRanksRef.current.get(key);
          const currRank = (itemsShown.find(x => x && !x.__sep && x.id === key) || {}).rank;
          if (typeof prevRank === 'number' && typeof currRank === 'number' && currRank < prevRank) {
            el.style.zIndex = '10'; // slide über andere beim Überholen
          }
          el.style.transform = 'translate(0, 0)';
          setTimeout(() => {
            if (rowRefs.current.get(key) === el) {
              el.style.zIndex = '';
              el.style.transition = '';
            }
          }, 450);
        });
      }
    }

    // Save current rects and ranks for next pass
    prevRectsRef.current = currRects;
    const rankMap = new Map();
    for (const it of itemsShown) {
      if (!it || it.__sep) continue;
      rankMap.set(it.id, it.rank);
    }
    prevRanksRef.current = rankMap;
  }, [itemsShown]);

  if (!roomCode) return null;

  return (
    <div className="sb">
      <div className="sb-header">Scoreboard</div>
      <ul className="sb-list">
        {itemsShown.length === 0 && (
          <li className="sb-empty">Keine Daten</li>
        )}
        {itemsShown.map((it, idx) => {
          if (it.__sep) return <li key={it.key} className="sb-sep" />;
          const isNumber = it.rank > 3; // ab Platz 4 Zahl anzeigen, sonst Medaille
          return (
            <li
              key={it.id ?? `row-${idx}`}
              className={rowClass(it)}
              ref={setRowRef(it.id)}
            >
              <span className="sb-rank">{isNumber ? `${it.rank}.` : medalForRank(it.rank)}</span>
              <span className="sb-name">{it.name}</span>
              <span className="sb-points">{it.points} Punkte</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const containerStyle = {
  position: 'absolute',
  top: 68,
  right: 12,
  zIndex: 2000,
  background: 'rgba(255,255,255,0.45)', // transparent
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
  minWidth: 340,  // +20px
  maxWidth: 460,  // etwas mehr Platz -> keine horizontale Scrollbar
  maxHeight: 320, // etwas höher -> keine winzige vertikale Scrollbar
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'saturate(120%) blur(3px)',
  WebkitBackdropFilter: 'saturate(120%) blur(3px)',
};

const headerStyle = {
  padding: '8px 10px',
  fontWeight: 700,
  borderBottom: '1px solid rgba(230,230,230,0.55)',
  background: 'rgba(250,250,250,0.40)', // transparenter Header
};

// self item is highlighted inline within the list instead of a separate box

const listStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  overflowY: 'auto',
  overflowX: 'hidden', // horizontale Scrollbar verhindern
};

const rowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,                          // kleinerer Abstand -> Content weiter links
  padding: '6px 10px 6px 8px',     // leicht weniger linker Innenabstand
  borderBottom: '1px solid rgba(240,240,240,0.45)',
  position: 'relative',
};

const rankStyle = {
  width: 28,               // feste Breite für saubere Spalten-Ausrichtung
  textAlign: 'right',      // Nummern rechtsbündig, Medaille sitzt in derselben Spalte
  color: '#555',
  display: 'inline-flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  userSelect: 'none',
  paddingRight: 2,
};

const nameStyle = {
  flex: 1,
  textAlign: 'left',
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'clip',
  wordBreak: 'break-word',
};
const pointsStyle = { fontVariantNumeric: 'tabular-nums', fontWeight: 600 };
const emptyStyle = { padding: '10px', color: '#777' };

const separatorStyle = { borderTop: '1px dashed rgba(200,200,200,0.6)', margin: '2px 6px' };

function rowRowStyle(it) {
  let base = { ...rowStyle };
  // Transparente, dezente Akzente für Top 1/2/3
  if (it.rank === 1) base = { ...base, background: 'rgba(255, 249, 230, 0.32)', borderLeft: '3px solid rgba(201,162,39,0.9)' };
  else if (it.rank === 2) base = { ...base, background: 'rgba(243, 244, 247, 0.32)', borderLeft: '3px solid rgba(138,141,147,0.9)' };
  else if (it.rank === 3) base = { ...base, background: 'rgba(249, 241, 232, 0.32)', borderLeft: '3px solid rgba(205,127,50,0.9)' };
  if (it.isSelf) base = { ...base, boxShadow: 'inset 0 0 0 2px rgba(214,233,255,0.7)' };
  return base;
}

function rankBadgeStyle(rank) {
  // eine gemeinsame Style-Funktion für Medaillen/Zahlen-Spalte
  return { ...rankStyle };
}

function medalForRank(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

// Ersetzt: Inline-Styles durch CSS-Klassen
function rowClass(it) {
  let cls = 'sb-row';
  if (it.rank === 1) cls += ' rank-1';
  else if (it.rank === 2) cls += ' rank-2';
  else if (it.rank === 3) cls += ' rank-3';
  if (it.isSelf) cls += ' self';
  return cls;
}
