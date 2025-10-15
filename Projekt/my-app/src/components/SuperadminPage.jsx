import React, { useState } from 'react';
import './SuperadminPage.css';
import managementIcon from '../assets/management.png';

// User-Icon als <span> wie auf der Startseite
const UserIcon = ({ onClick }) => (
	<span
		className="login-icon"
		aria-label="Nutzerverwaltung öffnen"
		onClick={onClick}
	>
		<img src={managementIcon} alt="Nutzerverwaltung" style={{ width: 40, height: 40, filter: 'brightness(0) invert(1)' }} />
	</span>
);

const Drawer = ({ open, onClose, children }) => {
	// Responsive Werte für Drawer
	const isMobile = window.innerWidth <= 600;
	const isTablet = window.innerWidth > 600 && window.innerWidth <= 1000;
	let drawerWidth = '98vw';
	let maxWidth = 600;
	if (isMobile) {
		drawerWidth = '100vw';
		maxWidth = '100vw';
	} else if (isTablet) {
		drawerWidth = '98vw';
		maxWidth = 700;
	}
	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				right: open ? 0 : '-100vw',
				width: drawerWidth,
				maxWidth: maxWidth,
				height: '100vh',
				background: '#fff',
				boxShadow: open ? '-2px 0 16px rgba(0,0,0,0.2)' : 'none',
				zIndex: 1000,
				transition: 'right 0.3s cubic-bezier(.4,0,.2,1)',
				display: 'flex',
				flexDirection: 'column',
				padding: 0
			}}
			aria-hidden={!open}
		>
			<div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 8 : 24 }}>{children}</div>
		</div>
	);
};

const SuperadminPage = () => {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	// Nutzer laden (API muss existieren)
	const fetchUsers = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await fetch('http://localhost:5000/api/users');
			if (!res.ok) throw new Error('Fehler beim Laden der Nutzer');
			const data = await res.json();
			setUsers(data.users || []);
		} catch (err) {
			setError('Nutzer konnten nicht geladen werden');
		} finally {
			setLoading(false);
		}
	};

		React.useEffect(() => {
			let interval;
			if (drawerOpen) {
				fetchUsers();
				interval = setInterval(() => {
					fetchUsers();
				}, 5000); // alle 5 Sekunden
			}
			return () => clearInterval(interval);
		}, [drawerOpen]);

	return (
		<>
			<UserIcon open={drawerOpen} onClick={() => setDrawerOpen((open) => !open)} />
			<Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
				<h2 style={{ fontSize: 22, margin: '0 0 16px 0', textAlign: 'center' }}>Nutzerverwaltung</h2>
				{loading ? (
					<div>Lade Nutzer...</div>
				) : error ? (
					<div style={{ color: 'red' }}>{error}</div>
				) : (
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: window.innerWidth <= 600 ? 15 : window.innerWidth <= 1000 ? 17 : 20 }}>
						<thead>
							<tr style={{ background: '#f5f5f5' }}>
								<th style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}>Benutzername</th>
								<th style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}>Rolle</th>
								<th style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}></th>
							</tr>
						</thead>
						<tbody>
											{users.map((user) => (
												<tr key={user.user_id} style={{ borderBottom: '1px solid #eee' }}>
													<td style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}>{user.name}</td>
													<td style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}>{user.role}</td>
													<td style={{ padding: window.innerWidth <= 600 ? 6 : 14, textAlign: 'left' }}>
														<button
															style={{
																marginRight: window.innerWidth <= 600 ? 4 : 10,
																background: '#083163',
																color: '#fff',
																border: 'none',
																borderRadius: 6,
																padding: window.innerWidth <= 600 ? '10px 10px' : '14px 20px',
																fontSize: window.innerWidth <= 600 ? 18 : 22,
																cursor: 'pointer'
															}}
															title="Bearbeiten"
															onClick={() => alert('Bearbeiten kommt noch!')}
														>
															✏️
														</button>
														<button
															style={{
																background: '#ff4136',
																color: '#fff',
																border: 'none',
																borderRadius: 6,
																padding: window.innerWidth <= 600 ? '10px 10px' : '14px 20px',
																fontSize: window.innerWidth <= 600 ? 18 : 22,
																cursor: 'pointer'
															}}
															title="Löschen"
															onClick={() => alert('Löschen kommt noch!')}
														>
															🗑️
														</button>
													</td>
												</tr>
											))}
						</tbody>
					</table>
				)}
						<div style={{ textAlign: 'center', marginTop: 28 }}>
							<button
								style={{
									background: '#083163',
									color: '#fff',
									border: 'none',
									borderRadius: 6,
									padding: window.innerWidth <= 600 ? '14px 18px' : '18px 32px',
									fontSize: window.innerWidth <= 600 ? 18 : 24,
									cursor: 'pointer',
									fontWeight: 600
								}}
								onClick={() => alert('Nutzer anlegen kommt noch!')}
							>
								+ Nutzer anlegen
							</button>
						</div>
			</Drawer>
		</>
	);
};

export default SuperadminPage;
