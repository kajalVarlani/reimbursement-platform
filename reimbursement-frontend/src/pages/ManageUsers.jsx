import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import {
  listUsers,
  createUser,
  deleteUser,
  listAdmins,
  createAdmin,
  deleteAdmin,
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from '../services/adminService';
import {
  HiOutlineLogout,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineTag,
} from 'react-icons/hi';
import { TbFileInvoice } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

const TABS = [
  { key: 'users', label: 'Users', icon: <HiOutlineUsers /> },
  { key: 'admins', label: 'Administrators', icon: <HiOutlineShieldCheck /> },
  { key: 'positions', label: 'Positions', icon: <HiOutlineTag /> },
];

/* ─── Confirm Delete Modal ─────────────────────────────────────── */
function DeleteConfirmModal({ name, onConfirm, onCancel, processing }) {
  return (
    <div className="details-modal-overlay" onClick={onCancel}>
      <div
        className="details-modal-card"
        style={{ maxWidth: '420px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">Confirm Delete</h3>
          <button className="modal-close-btn" onClick={onCancel}>
            <HiOutlineX />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>? This action cannot be
            undone.
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={onCancel} disabled={processing}>
              Cancel
            </button>
            <button className="btn-confirm-reject" onClick={onConfirm} disabled={processing} id="btn-confirm-delete">
              {processing ? <><span className="btn-spinner" /> Deleting…</> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Users Tab ─────────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        return u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [users, searchTerm]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSubmitting(true);
    const toastId = toast.loading('Creating user…');
    try {
      await createUser({ name: form.name.trim(), email: form.email.trim() });
      toast.success('User created! Credentials sent via email.', { id: toastId });
      setForm({ name: '', email: '' });
      setShowForm(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading('Deleting user…');
    try {
      await deleteUser(deleteTarget.id);
      toast.success('User deleted.', { id: toastId });
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="tab-content-header" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: '1 1 auto' }}>
          <span className="tab-count">{users.length} users</span>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '12px', height: '36px', fontSize: '13px', width: '220px' }}
            placeholder="Search users by name/email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn-secondary" onClick={() => setSearchTerm('')} style={{ padding: '6px 12px', height: '36px', fontSize: '12.5px' }}>
              Clear
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} id="btn-add-user">
          <HiOutlinePlus /> Add User
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <form className="inline-form animate-fade-in-up" onSubmit={handleCreate} id="create-user-form">
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="new-user-name">Full Name</label>
              <input
                id="new-user-name"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-user-email">Email Address</label>
              <input
                id="new-user-email"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} id="btn-create-user-submit">
              {submitting ? <><span className="btn-spinner" /> Creating…</> : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <HiOutlineUsers className="empty-state-icon" />
            <h3 className="empty-state-title">No users yet</h3>
            <p className="empty-state-text">Add your first user to get started.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <HiOutlineUsers className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3 className="empty-state-title">No matching users</h3>
            <p className="empty-state-text">Try adjusting your search query.</p>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Member Since</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                  <td className="cell-bold">{u.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-action-delete"
                      onClick={() => setDeleteTarget(u)}
                      title="Delete user"
                      id={`btn-delete-user-${u.id}`}
                    >
                      <HiOutlineTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          target="user"
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          processing={deleting}
        />
      )}
    </>
  );
}

/* ─── Admins Tab ────────────────────────────────────────────────── */
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'ADMINISTRATOR', positionId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');

  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = a.name?.toLowerCase().includes(term);
        const matchesEmail = a.email?.toLowerCase().includes(term);
        if (!matchesName && !matchesEmail) return false;
      }

      if (roleFilter && a.role !== roleFilter) {
        return false;
      }

      if (positionFilter && a.positionId !== positionFilter) {
        return false;
      }

      return true;
    });
  }, [admins, searchTerm, roleFilter, positionFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsData, posData] = await Promise.all([listAdmins(), listPositions()]);
      setAdmins(adminsData);
      setPositions(posData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load administrators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (form.role === 'ADMINISTRATOR' && !form.positionId) {
      toast.error('Position is required for administrators');
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading('Creating administrator…');
    try {
      await createAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        positionId: form.role === 'ADMINISTRATOR' ? form.positionId : undefined,
      });
      toast.success('Administrator created! Credentials sent via email.', { id: toastId });
      setForm({ name: '', email: '', role: 'ADMINISTRATOR', positionId: '' });
      setShowForm(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading('Deleting administrator…');
    try {
      await deleteAdmin(deleteTarget.id);
      toast.success('Administrator deleted.', { id: toastId });
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete admin', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="tab-content-header" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 auto' }}>
          <span className="tab-count">{admins.length} admins</span>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '12px', height: '36px', fontSize: '13px', width: '180px' }}
            placeholder="Search admins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="form-select"
            style={{ height: '36px', fontSize: '12.5px', padding: '0 10px', minWidth: '120px' }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
          <select
            className="form-select"
            style={{ height: '36px', fontSize: '12.5px', padding: '0 10px', minWidth: '150px' }}
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <option value="">All Positions</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>{pos.name} (L{pos.priority})</option>
            ))}
          </select>
          {(searchTerm || roleFilter || positionFilter) && (
            <button className="btn-secondary" onClick={() => { setSearchTerm(''); setRoleFilter(''); setPositionFilter(''); }} style={{ padding: '6px 12px', height: '36px', fontSize: '12.5px' }}>
              Clear
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} id="btn-add-admin">
          <HiOutlinePlus /> Add Administrator
        </button>
      </div>

      {showForm && (
        <form className="inline-form animate-fade-in-up" onSubmit={handleCreate} id="create-admin-form">
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="new-admin-name">Full Name</label>
              <input
                id="new-admin-name"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="John Admin"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-admin-email">Email Address</label>
              <input
                id="new-admin-email"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="email"
                placeholder="admin@org.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="new-admin-role">Role</label>
              <select
                id="new-admin-role"
                className="form-select"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value, positionId: '' }))}
              >
                <option value="ADMINISTRATOR">Administrator</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            {form.role === 'ADMINISTRATOR' && (
              <div className="form-group">
                <label className="form-label" htmlFor="new-admin-position">Position</label>
                <select
                  id="new-admin-position"
                  className="form-select"
                  value={form.positionId}
                  onChange={(e) => setForm((p) => ({ ...p, positionId: e.target.value }))}
                  required
                >
                  <option value="" disabled>Select a position</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name} (Level {pos.priority})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} id="btn-create-admin-submit">
              {submitting ? <><span className="btn-spinner" /> Creating…</> : 'Create Administrator'}
            </button>
          </div>
        </form>
      )}

      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : admins.length === 0 ? (
          <div className="empty-state">
            <HiOutlineShieldCheck className="empty-state-icon" />
            <h3 className="empty-state-title">No administrators yet</h3>
            <p className="empty-state-text">Add your first administrator to build the approval workflow.</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <HiOutlineShieldCheck className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3 className="empty-state-title">No matching administrators</h3>
            <p className="empty-state-text">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Position</th>
                <th>Since</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                  <td className="cell-bold">{a.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{a.email}</td>
                  <td>
                    <span className={`role-badge ${a.role === 'SUPER_ADMIN' ? 'role-super' : 'role-admin'}`}>
                      {a.role === 'SUPER_ADMIN' ? '🛡️ Super Admin' : 'Administrator'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {a.position ? `${a.position.name} (L${a.position.priority})` : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-action-delete"
                      onClick={() => setDeleteTarget(a)}
                      title="Delete administrator"
                      id={`btn-delete-admin-${a.id}`}
                    >
                      <HiOutlineTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          target="admin"
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          processing={deleting}
        />
      )}
    </>
  );
}

/* ─── Positions Tab ─────────────────────────────────────────────── */
function PositionsTab() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', priority: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', priority: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        return p.name?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [positions, searchTerm]);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPositions();
      setPositions(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPositions();
  }, [fetchPositions]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.priority) return;
    setSubmitting(true);
    const toastId = toast.loading('Creating position…');
    try {
      await createPosition({ name: form.name.trim(), priority: parseInt(form.priority) });
      toast.success('Position created!', { id: toastId });
      setForm({ name: '', priority: '' });
      setShowForm(false);
      await fetchPositions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create position', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (pos) => {
    setEditingId(pos.id);
    setEditForm({ name: pos.name, priority: String(pos.priority) });
  };

  const handleEditSave = async (id) => {
    if (!editForm.name.trim() || !editForm.priority) return;
    setEditSaving(true);
    const toastId = toast.loading('Saving…');
    try {
      await updatePosition(id, { name: editForm.name.trim(), priority: parseInt(editForm.priority) });
      toast.success('Position updated!', { id: toastId });
      setEditingId(null);
      await fetchPositions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update position', { id: toastId });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading('Deleting position…');
    try {
      await deletePosition(deleteTarget.id);
      toast.success('Position deleted.', { id: toastId });
      setDeleteTarget(null);
      await fetchPositions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete position', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="tab-content-header" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: '1 1 auto' }}>
          <span className="tab-count">{positions.length} positions</span>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '12px', height: '36px', fontSize: '13px', width: '220px' }}
            placeholder="Search positions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn-secondary" onClick={() => setSearchTerm('')} style={{ padding: '6px 12px', height: '36px', fontSize: '12.5px' }}>
              Clear
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} id="btn-add-position">
          <HiOutlinePlus /> Add Position
        </button>
      </div>

      {showForm && (
        <form className="inline-form animate-fade-in-up" onSubmit={handleCreate} id="create-position-form">
          <div className="form-row-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-pos-name">Position Name</label>
              <input
                id="new-pos-name"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="e.g. Department Head"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-pos-priority">
                Priority Level
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(1 = first)</span>
              </label>
              <input
                id="new-pos-priority"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} id="btn-create-position-submit">
              {submitting ? <><span className="btn-spinner" /> Creating…</> : 'Create Position'}
            </button>
          </div>
        </form>
      )}

      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : positions.length === 0 ? (
          <div className="empty-state">
            <HiOutlineTag className="empty-state-icon" />
            <h3 className="empty-state-title">No positions defined</h3>
            <p className="empty-state-text">
              Create positions to define the approval hierarchy for reimbursement claims.
            </p>
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <HiOutlineTag className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
            <h3 className="empty-state-title">No matching positions</h3>
            <p className="empty-state-text">Try adjusting your search query.</p>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>Position Name</th>
                <th>Priority Level</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((pos) => (
                <tr key={pos.id}>
                  {editingId === pos.id ? (
                    <>
                      <td>
                        <input
                          className="form-input inline-edit-input"
                          style={{ paddingLeft: '10px' }}
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          id={`edit-pos-name-${pos.id}`}
                        />
                      </td>
                      <td>
                        <input
                          className="form-input inline-edit-input"
                          style={{ paddingLeft: '10px', width: '80px' }}
                          type="number"
                          min="1"
                          value={editForm.priority}
                          onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value }))}
                          id={`edit-pos-priority-${pos.id}`}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btn-group">
                          <button
                            className="btn-action-approve"
                            onClick={() => handleEditSave(pos.id)}
                            disabled={editSaving}
                            title="Save"
                            id={`btn-save-pos-${pos.id}`}
                          >
                            <HiOutlineCheck />
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            className="btn-action-icon"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                          >
                            <HiOutlineX />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="cell-bold">{pos.name}</td>
                      <td>
                        <span className="priority-badge">Level {pos.priority}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btn-group">
                          <button
                            className="btn-action-icon"
                            onClick={() => startEdit(pos)}
                            title="Edit position"
                            id={`btn-edit-pos-${pos.id}`}
                          >
                            <HiOutlinePencil />
                          </button>
                          <button
                            className="btn-action-delete"
                            onClick={() => setDeleteTarget(pos)}
                            title="Delete position"
                            id={`btn-delete-pos-${pos.id}`}
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          target="position"
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          processing={deleting}
        />
      )}
    </>
  );
}

/* ─── ManageUsers Page ──────────────────────────────────────────── */
function ManageUsers() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('users');

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="dashboard-container">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand">
          <img src="/infernxt-logo.png" alt="inferNXT" className="brand-logo brand-logo-company" />
        </div>
        <div className="header-user-actions">
          <img src="/claimnest-logo-clean.png" alt="ClaimNest" className="brand-logo brand-logo-product" />
          <button
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => navigate('/admin/history')}
            id="btn-go-history"
          >
            View History
          </button>
          <button
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => navigate('/admin/dashboard')}
            id="btn-go-approval-queue"
          >
            Approval Queue
          </button>
          <div className="user-profile-badge">
            <div className="avatar-circle admin-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{user?.name || 'Super Admin'}</span>
              <span style={{ fontSize: '11px', color: 'var(--wc-300)', fontWeight: 500 }}>Super Admin</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} id="manage-logout-btn">
            <HiOutlineLogout />
            Logout
          </button>
        </div>
      </header>


      {/* ── Main ── */}
      <main className="dashboard-main animate-fade-in">
        <div className="section-header">
          <div className="section-title">
            Manage
            <span className="section-subtitle">
              Control users, administrators, and the approval hierarchy
            </span>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              id={`tab-${tab.key}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <section className="claims-card tab-panel">
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'admins' && <AdminsTab />}
          {activeTab === 'positions' && <PositionsTab />}
        </section>
      </main>
    </div>
  );
}

export default ManageUsers;
