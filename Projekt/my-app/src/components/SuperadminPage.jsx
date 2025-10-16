import React, { useState } from 'react';
import './SuperadminPage.css';
import managementIcon from '../assets/management.png';
import editIcon from '../assets/edit-pencil.png';
import deleteIcon from '../assets/trash-bin.png';

// User-Icon als <span> wie auf der Startseite
const UserIcon = ({ onClick }) => (
	<span
		className="login-icon"
		aria-label="Nutzerverwaltung öffnen"
		onClick={onClick}
	>
		<img src={managementIcon} alt="Nutzerverwaltung" className="sa-user-icon-img" />
	</span>
);

const Drawer = ({ open, onClose, children }) => {
	return (
		<div className={`sa-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
			<div className="sa-drawer-content">{children}</div>
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
			const res = await fetch('/api/users');
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
			const res = await fetch('/api/users', {
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
			const res = await fetch(`/api/users/${selectedUserId}`, {
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
			const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
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
				<h2 className="sa-title">Nutzerverwaltung</h2>
				{actionError && <div className="sa-error">{actionError}</div>}

				{/* Create / Edit Form */}
				{showCreate && (
					<form onSubmit={handleCreateUser} className="sa-form">
						<div className="sa-form-title">Neuen Nutzer anlegen</div>
						<div className="sa-form-row">
							<input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Benutzername" className="sa-input" />
							<select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="sa-select">
								<option value="superadmin">superadmin</option>
								<option value="admin">admin</option>
								<option value="closed">closed</option>
							</select>
							<input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Passwort" className="sa-input" />
						</div>
						<div className="sa-actions">
							<button type="submit" className="sa-btn sa-btn-primary">Anlegen</button>
							<button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="sa-btn sa-btn-secondary">Abbrechen</button>
						</div>
					</form>
				)}

				{showEdit && (
					<form onSubmit={handleUpdateUser} className="sa-form">
						<div className="sa-form-title">Nutzer bearbeiten</div>
						<div className="sa-form-row">
							<input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Benutzername" className="sa-input" />
							<select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="sa-select">
								<option value="superadmin">superadmin</option>
								<option value="admin">admin</option>
								<option value="closed">closed</option>
							</select>
							<input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Neues Passwort (optional)" className="sa-input sa-input-wide" />
						</div>
						<div className="sa-actions">
							<button type="submit" className="sa-btn sa-btn-primary">Speichern</button>
							<button type="button" onClick={() => { setShowEdit(false); resetForm(); }} className="sa-btn sa-btn-secondary">Abbrechen</button>
						</div>
					</form>
				)}
				{loading ? (
					<div>Lade Nutzer...</div>
				) : error ? (
					<div className="sa-error">{error}</div>
				) : (
				  <div className="sa-table-wrap">
					<table className="superadmin-table">
						<thead>
							<tr>
								<th>Benutzername</th>
								<th>Rolle</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
											{users.map((user) => (
												<tr key={user.user_id}>
													<td>{user.name}</td>
													<td>{user.role}</td>
													<td>
														<button
															className="sa-btn sa-btn-primary sa-action-btn"
															title="Bearbeiten"
															onClick={() => openEdit(user)}
														>
															<img src={editIcon} alt="Bearbeiten" className="sa-action-icon" />
														</button>
														<button
															className="sa-btn sa-btn-danger sa-action-btn"
															title="Löschen"
															onClick={() => handleDeleteUser(user.user_id)}
														>
															<img src={deleteIcon} alt="Löschen" className="sa-action-icon" />
														</button>
													</td>
												</tr>
											))}
						</tbody>
					</table>
				  </div>
				)}
						<div className="sa-footer">
							<button className="sa-btn sa-btn-primary sa-cta-btn" onClick={() => openCreate()}>
								+ Nutzer anlegen
							</button>
						</div>
			</Drawer>
		</>
	);
};

export default SuperadminPage;
