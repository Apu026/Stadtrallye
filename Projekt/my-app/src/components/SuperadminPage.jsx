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
	// Create/Edit state
	const [showCreate, setShowCreate] = useState(false);
	const [showEdit, setShowEdit] = useState(false);
	const [formName, setFormName] = useState('');
	const [formRole, setFormRole] = useState('admin');
	const [formPassword, setFormPassword] = useState('');
	const [selectedUserId, setSelectedUserId] = useState(null);
	const [actionError, setActionError] = useState('');

	// Nutzer laden (API muss existieren)
	const fetchUsers = async (showSpinner = true) => {
		if (showSpinner) setLoading(true);
		setError('');
		try {
			const res = await fetch('http://localhost:5000/api/users');
			if (!res.ok) throw new Error('Fehler beim Laden der Nutzer');
			const data = await res.json();
			setUsers(data.users || []);
		} catch (err) {
			setError('Nutzer konnten nicht geladen werden');
		} finally {
			if (showSpinner) setLoading(false);
		}
	};

		React.useEffect(() => {
			let interval;
			if (drawerOpen) {
				fetchUsers();
				interval = setInterval(() => {
					fetchUsers(false);
				}, 5000); // alle 5 Sekunden
			}
			return () => clearInterval(interval);
		}, [drawerOpen]);

	// Helpers for forms
	const resetForm = () => {
		setFormName('');
		setFormRole('admin');
		setFormPassword('');
		setSelectedUserId(null);
		setActionError('');
	};

	const openCreate = () => {
		resetForm();
		setShowCreate(true);
		setShowEdit(false);
	};

	const openEdit = (user) => {
		setSelectedUserId(user.user_id);
		setFormName(user.name || '');
		setFormRole(user.role || 'admin');
		setFormPassword('');
		setActionError('');
		setShowEdit(true);
		setShowCreate(false);
	};

	const handleCreateUser = async (e) => {
		e?.preventDefault();
		setActionError('');
		if (!formName || !formRole || !formPassword) {
			setActionError('Bitte Name, Rolle und Passwort angeben');
			return;
		}
		try {
			const res = await fetch('http://localhost:5000/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: formName, role: formRole, password: formPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error || 'Fehler beim Anlegen');
				return;
			}
			resetForm();
			setShowCreate(false);
			await fetchUsers();
		} catch (err) {
			setActionError('Server nicht erreichbar');
		}
	};

	const handleUpdateUser = async (e) => {
		e?.preventDefault();
		setActionError('');
		if (!selectedUserId) return;
		try {
			const payload = { };
			if (formName) payload.name = formName;
			if (formRole) payload.role = formRole;
			if (formPassword) payload.password = formPassword;
			const res = await fetch(`http://localhost:5000/api/users/${selectedUserId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error || 'Fehler beim Aktualisieren');
				return;
			}
			resetForm();
			setShowEdit(false);
			await fetchUsers();
		} catch (err) {
			setActionError('Server nicht erreichbar');
		}
	};

	const handleDeleteUser = async (userId) => {
		setActionError('');
		if (!window.confirm('Diesen Nutzer wirklich löschen?')) return;
		try {
			const res = await fetch(`http://localhost:5000/api/users/${userId}`, { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error || 'Fehler beim Löschen');
				return;
			}
			await fetchUsers();
		} catch (err) {
			setActionError('Server nicht erreichbar');
		}
	};

	return (
		<>
			<UserIcon open={drawerOpen} onClick={() => setDrawerOpen((open) => !open)} />
			<Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
				<h2 style={{ fontSize: 22, margin: '0 0 16px 0', textAlign: 'center' }}>Nutzerverwaltung</h2>
				{actionError && <div style={{ color: 'red', marginBottom: 10 }}>{actionError}</div>}

				{/* Create / Edit Form */}
				{showCreate && (
					<form onSubmit={handleCreateUser} style={{ background: '#f8f9fb', border: '1px solid #e2e6ea', borderRadius: 8, padding: 12, marginBottom: 16 }}>
						<div style={{ fontWeight: 600, marginBottom: 8 }}>Neuen Nutzer anlegen</div>
						<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
							<input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Benutzername" style={{ flex: '1 1 160px', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
							<select value={formRole} onChange={(e) => setFormRole(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
								<option value="superadmin">superadmin</option>
								<option value="admin">admin</option>
								<option value="closed">closed</option>
							</select>
							<input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Passwort" style={{ flex: '1 1 160px', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
						</div>
						<div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
							<button type="submit" style={{ background: '#083163', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Anlegen</button>
							<button type="button" onClick={() => { setShowCreate(false); resetForm(); }} style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Abbrechen</button>
						</div>
					</form>
				)}

				{showEdit && (
					<form onSubmit={handleUpdateUser} style={{ background: '#f8f9fb', border: '1px solid #e2e6ea', borderRadius: 8, padding: 12, marginBottom: 16 }}>
						<div style={{ fontWeight: 600, marginBottom: 8 }}>Nutzer bearbeiten</div>
						<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
							<input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Benutzername" style={{ flex: '1 1 160px', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
							<select value={formRole} onChange={(e) => setFormRole(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
								<option value="superadmin">superadmin</option>
								<option value="admin">admin</option>
								<option value="closed">closed</option>
							</select>
							<input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Neues Passwort (optional)" style={{ flex: '1 1 220px', padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
						</div>
						<div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
							<button type="submit" style={{ background: '#083163', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Speichern</button>
							<button type="button" onClick={() => { setShowEdit(false); resetForm(); }} style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>Abbrechen</button>
						</div>
					</form>
				)}
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
															onClick={() => openEdit(user)}
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
															onClick={() => handleDeleteUser(user.user_id)}
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
								onClick={() => openCreate()}
							>
								+ Nutzer anlegen
							</button>
						</div>
			</Drawer>
		</>
	);
};

export default SuperadminPage;
