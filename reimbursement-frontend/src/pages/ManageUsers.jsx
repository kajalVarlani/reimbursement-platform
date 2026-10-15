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
  listClubMappings,
  upsertClubMapping,
  deleteClubMapping,
  listFacultyMentors,
  getBufferStatus,
  replenishBuffer,
  topUpBuffer,
  setProjectionWindow,
  listProjections,
  exportTreasurerMonthlyIndent,
  getIndentSummary,
  getClubBudgets,
  upsertClubBudget,
  deleteClubBudget,
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
  HiOutlineLink,
  HiOutlineCurrencyRupee,
  HiOutlineCalendar,
  HiOutlineDocumentDownload,
  HiOutlineRefresh,
} from 'react-icons/hi';
import { TbFileInvoice } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

const TABS = [
  { key: 'users', label: 'Users', icon: <HiOutlineUsers /> },
  { key: 'admins', label: 'Administrators', icon: <HiOutlineShieldCheck /> },
  { key: 'positions', label: 'Positions', icon: <HiOutlineTag /> },
  { key: 'club-mappings', label: 'Club Mappings', icon: <HiOutlineLink /> },
  { key: 'club-budgets', label: 'Club Budgets', icon: <TbFileInvoice /> },
  { key: 'buffer', label: 'Advance Buffer', icon: <HiOutlineCurrencyRupee /> },
  { key: 'indent', label: 'Monthly Indent', icon: <HiOutlineDocumentDownload /> },
  { key: 'projections', label: 'Projections', icon: <HiOutlineCalendar /> },
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
  const [form, setForm] = useState({ name: '', email: '', designation: '', clubName: '' });
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
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        designation: form.designation || undefined,
        clubName: form.clubName.trim() || undefined,
      });
      toast.success('User created! Credentials sent via email.', { id: toastId });
      setForm({ name: '', email: '', designation: '', clubName: '' });
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
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="new-user-designation">Designation</label>
              <select
                id="new-user-designation"
                className="form-select"
                value={form.designation}
                onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
              >
                <option value="">— No designation —</option>
                <option value="CONVENOR">Convenor</option>
                <option value="DEPUTY_CONVENOR">Deputy Convenor</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-user-club">Club / Committee</label>
              <input
                id="new-user-club"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="e.g. Music Club, Chess Club"
                value={form.clubName}
                onChange={(e) => setForm((p) => ({ ...p, clubName: e.target.value }))}
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
                <th>Designation</th>
                <th>Club / Committee</th>
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
                  <td>
                    {u.designation ? (
                      <span className={`status-badge ${u.designation === 'CONVENOR' ? 'badge-approved' : 'badge-pending'}`}>
                        {u.designation === 'CONVENOR' ? 'Convenor' : 'Deputy Convenor'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {u.clubName || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
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

/* ─── Club Mappings Tab ─────────────────────────────────────────── */
function ClubMappingsTab() {
  const [mappings, setMappings] = useState([]);
  const [facultyMentors, setFacultyMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clubName: '', facultyMentorId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsData, mentorsData] = await Promise.all([listClubMappings(), listFacultyMentors()]);
      setMappings(mappingsData);
      setFacultyMentors(mentorsData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load club mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpsert = async (e) => {
    e.preventDefault();
    if (!form.clubName.trim() || !form.facultyMentorId) {
      toast.error('Club name and Faculty Mentor are required');
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading('Saving mapping…');
    try {
      await upsertClubMapping({ clubName: form.clubName.trim(), facultyMentorId: form.facultyMentorId });
      toast.success('Club-Faculty mapping saved!', { id: toastId });
      setForm({ clubName: '', facultyMentorId: '' });
      setShowForm(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save mapping', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading('Removing mapping…');
    try {
      await deleteClubMapping(deleteTarget.id);
      toast.success('Mapping removed.', { id: toastId });
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove mapping', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="tab-content-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="tab-count">{mappings.length} mappings</span>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Maps each Club / Committee to its designated Faculty Mentor for approval routing.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} id="btn-add-mapping">
          <HiOutlinePlus /> Add / Update Mapping
        </button>
      </div>

      {showForm && (
        <form className="inline-form animate-fade-in-up" onSubmit={handleUpsert} id="club-mapping-form">
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="mapping-club">Club / Committee Name</label>
              <input
                id="mapping-club"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="e.g. Music Club"
                value={form.clubName}
                onChange={(e) => setForm((p) => ({ ...p, clubName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mapping-mentor">Faculty Mentor</label>
              <select
                id="mapping-mentor"
                className="form-select"
                value={form.facultyMentorId}
                onChange={(e) => setForm((p) => ({ ...p, facultyMentorId: e.target.value }))}
                required
              >
                <option value="" disabled>— Select Faculty Mentor —</option>
                {facultyMentors.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting} id="btn-save-mapping">
              {submitting ? <><span className="btn-spinner" /> Saving…</> : 'Save Mapping'}
            </button>
          </div>
        </form>
      )}

      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : mappings.length === 0 ? (
          <div className="empty-state">
            <HiOutlineLink className="empty-state-icon" />
            <h3 className="empty-state-title">No club mappings yet</h3>
            <p className="empty-state-text">Add mappings to route each club's claims to the correct Faculty Mentor.</p>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club / Committee</th>
                <th>Faculty Mentor</th>
                <th>Mentor Email</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                  <td className="cell-bold">{m.clubName}</td>
                  <td>{m.facultyMentor?.name || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{m.facultyMentor?.email || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-action-delete"
                      onClick={() => setDeleteTarget(m)}
                      title="Remove mapping"
                      id={`btn-delete-mapping-${m.id}`}
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
          name={`${deleteTarget.clubName} → ${deleteTarget.facultyMentor?.name}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          processing={deleting}
        />
      )}
    </>
  );
}

/* ─── Buffer Management Tab ─────────────────────────────────────── */
function BufferTab() {
  const [buffer, setBuffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replenishForm, setReplenishForm] = useState({ amount: '', month: '', notes: '' });
  const [topUpForm, setTopUpForm] = useState({ amount: '', notes: '' });
  const [replenishing, setReplenishing] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const fetchBuffer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBufferStatus();
      setBuffer(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load buffer status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBuffer(); }, [fetchBuffer]);

  const handleReplenish = async (e) => {
    e.preventDefault();
    if (!replenishForm.amount || !replenishForm.month) {
      toast.error('Amount and target month are required');
      return;
    }
    setReplenishing(true);
    const toastId = toast.loading('Setting monthly buffer…');
    try {
      await replenishBuffer({ amount: parseFloat(replenishForm.amount), month: replenishForm.month, notes: replenishForm.notes });
      toast.success('Monthly buffer replenished!', { id: toastId });
      setReplenishForm({ amount: '', month: '', notes: '' });
      await fetchBuffer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to replenish buffer', { id: toastId });
    } finally {
      setReplenishing(false);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (!topUpForm.amount) {
      toast.error('Amount is required');
      return;
    }
    setToppingUp(true);
    const toastId = toast.loading('Adding top-up…');
    try {
      await topUpBuffer({ amount: parseFloat(topUpForm.amount), notes: topUpForm.notes });
      toast.success('Buffer topped up!', { id: toastId });
      setTopUpForm({ amount: '', notes: '' });
      await fetchBuffer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to top up buffer', { id: toastId });
    } finally {
      setToppingUp(false);
    }
  };

  const balancePct = buffer ? Math.min(100, Math.round((buffer.currentBalance / buffer.monthlyAdvance) * 100)) : 0;

  return (
    <div style={{ padding: '8px 0' }}>
      {loading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
        </div>
      ) : buffer ? (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="kpi-card">
              <div className="kpi-label">Month</div>
              <div className="kpi-value" style={{ fontSize: '22px' }}>{buffer.currentMonth}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Monthly Advance Allocated</div>
              <div className="kpi-value">₹{buffer.monthlyAdvance?.toLocaleString('en-IN')}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Available Balance</div>
              <div className="kpi-value" style={{ color: buffer.currentBalance <= 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                ₹{buffer.currentBalance?.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Utilisation</div>
              <div className="kpi-value">{balancePct}% remaining</div>
            </div>
          </div>
          {/* Progress Bar */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Buffer Utilisation</span>
              <span>{balancePct}% remaining</span>
            </div>
            <div style={{ height: '10px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${balancePct}%`,
                background: balancePct > 40 ? 'var(--color-success)' : balancePct > 15 ? '#f59e0b' : 'var(--color-danger)',
                borderRadius: '999px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <HiOutlineCurrencyRupee className="empty-state-icon" />
          <h3 className="empty-state-title">No buffer set for this month</h3>
          <p className="empty-state-text">Use the form below to set the monthly advance buffer.</p>
        </div>
      )}

      {/* Replenish Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px' }}>
        <div className="inline-form" style={{ margin: 0, padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>Monthly Buffer Replenishment</h4>
          <form onSubmit={handleReplenish} id="replenish-buffer-form">
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" htmlFor="replenish-month">Target Month (YYYY-MM)</label>
              <input
                id="replenish-month"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="month"
                value={replenishForm.month}
                onChange={(e) => setReplenishForm((p) => ({ ...p, month: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" htmlFor="replenish-amount">Buffer Amount (₹)</label>
              <input
                id="replenish-amount"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="number"
                min="1"
                placeholder="e.g. 50000"
                value={replenishForm.amount}
                onChange={(e) => setReplenishForm((p) => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="replenish-notes">Notes (optional)</label>
              <input
                id="replenish-notes"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="e.g. Received from Accounts Dept"
                value={replenishForm.notes}
                onChange={(e) => setReplenishForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={replenishing} id="btn-replenish-buffer" style={{ width: '100%' }}>
              {replenishing ? <><span className="btn-spinner" /> Setting…</> : 'Set Monthly Buffer'}
            </button>
          </form>
        </div>

        {/* Top-Up Form */}
        <div className="inline-form" style={{ margin: 0, padding: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>Ad-hoc Top-Up</h4>
          <form onSubmit={handleTopUp} id="topup-buffer-form">
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" htmlFor="topup-amount">Top-Up Amount (₹)</label>
              <input
                id="topup-amount"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="number"
                min="1"
                placeholder="e.g. 10000"
                value={topUpForm.amount}
                onChange={(e) => setTopUpForm((p) => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="topup-notes">Notes (optional)</label>
              <input
                id="topup-notes"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="e.g. Emergency top-up for festival"
                value={topUpForm.notes}
                onChange={(e) => setTopUpForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={toppingUp} id="btn-topup-buffer" style={{ width: '100%' }}>
              {toppingUp ? <><span className="btn-spinner" /> Adding…</> : 'Add Top-Up'}
            </button>
          </form>
        </div>
      </div>

      {/* Buffer Transaction History Table */}
      {buffer?.transactions && buffer.transactions.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Recent Buffer Transactions &amp; Debits ({buffer.transactions.length})
          </h4>
          <div className="claims-table-wrapper">
            <table className="claims-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Transaction Type</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ textAlign: 'right' }}>Balance After (₹)</th>
                  <th>Notes / Claim Reference</th>
                </tr>
              </thead>
              <tbody>
                {buffer.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(tx.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: tx.type === 'REIMBURSEMENT_PAYOUT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tx.type === 'REIMBURSEMENT_PAYOUT' ? '#ef4444' : '#10b981',
                      }}>
                        {tx.type === 'REIMBURSEMENT_PAYOUT' ? 'Debit (Claim Payout)' : tx.type === 'TOP_UP' ? 'Credit (Top-Up)' : 'Replenishment'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: tx.type === 'REIMBURSEMENT_PAYOUT' ? '#ef4444' : '#10b981' }}>
                      {tx.type === 'REIMBURSEMENT_PAYOUT' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{tx.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {tx.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Monthly Indent Tab (Treasurer Official Reconciliation & Export) ─── */
function IndentTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [indentMonth, setIndentMonth] = useState(defaultMonth);
  const [indentSummary, setIndentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchIndent = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getIndentSummary(indentMonth);
      setIndentSummary(summary);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load indent summary');
    } finally {
      setLoading(false);
    }
  }, [indentMonth]);

  useEffect(() => {
    fetchIndent();
  }, [fetchIndent]);

  const handleExportIndent = async () => {
    setExporting(true);
    const toastId = toast.loading(`Generating official indent for ${indentMonth}…`);
    try {
      await exportTreasurerMonthlyIndent(indentMonth);
      toast.success('Official Indent (.xlsx) downloaded successfully!', { id: toastId });
      await fetchIndent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export indent', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Treasurer Monthly Indent &amp; Audit Reconciliation
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Official university reconciliation of Advance Buffer settlements, Central Accountant disbursements, and physical bill checklists.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="indent-tab-month" style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Indent Month
            </label>
            <input
              id="indent-tab-month"
              className="form-input"
              style={{ paddingLeft: '12px', height: '38px', fontSize: '13px', width: '160px' }}
              type="month"
              value={indentMonth}
              onChange={(e) => setIndentMonth(e.target.value)}
            />
          </div>

          <button
            className="btn-secondary"
            onClick={fetchIndent}
            style={{ padding: '8px 14px', height: '38px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '18px' }}
            id="btn-refresh-indent"
          >
            <HiOutlineRefresh /> Refresh
          </button>

          <button
            className="btn-primary"
            onClick={handleExportIndent}
            disabled={exporting}
            style={{ padding: '8px 20px', height: '38px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px' }}
            id="btn-generate-indent"
          >
            {exporting ? <><span className="btn-spinner" /> Generating…</> : <><HiOutlineDocumentDownload style={{ fontSize: '16px' }} /> Download Official Indent (.xlsx)</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
        </div>
      ) : indentSummary ? (
        <>
          {/* KPI Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Advance Buffer Allocation</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                ₹{indentSummary.monthlyAdvance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Remaining: <strong style={{ color: indentSummary.currentBalance < 10000 ? '#ef4444' : '#10b981' }}>₹{indentSummary.currentBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid via Buffer</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--wc-200)', marginTop: '4px' }}>
                ₹{indentSummary.bufferTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {indentSummary.bufferClaimsCount || 0} claims settled
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Central Accountant</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
                ₹{indentSummary.accountantTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {indentSummary.accountantClaimsCount || 0} routed claims
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Monthly Disbursed</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                ₹{indentSummary.totalDisbursed?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {indentSummary.totalClaimsCount || 0} claims ({indentSummary.totalBills || 0} bills)
              </div>
            </div>
          </div>

          {/* Buffer Status Banner */}
          <div style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            background: indentSummary.isBufferExhausted ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${indentSummary.isBufferExhausted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            <div>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Buffer Reconciliation Status: </strong>
              <span style={{ color: indentSummary.isBufferExhausted ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '13.5px' }}>
                {indentSummary.isBufferExhausted ? 'EXHAUSTED (All Payouts Routed to Central Accountant)' : 'SURPLUS AVAILABLE (Advance Buffer Healthy)'}
              </span>
            </div>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Physical paper bills attached to indent: <strong>{indentSummary.totalBills || 0} bills</strong>
            </span>
          </div>

          {/* Reconciled Claims Table */}
          <div className="claims-table-wrapper">
            <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '14px 18px 10px', color: 'var(--text-primary)' }}>
              Reconciled Claims for {indentMonth} ({indentSummary.reimbursements?.length || 0})
            </h4>
            {indentSummary.reimbursements && indentSummary.reimbursements.length > 0 ? (
              <table className="claims-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paid Date</th>
                    <th>Club / Committee</th>
                    <th>Event</th>
                    <th>Payee</th>
                    <th>Payment Mode &amp; Ref</th>
                    <th>Funding Channel</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ textAlign: 'center' }}>Bills</th>
                  </tr>
                </thead>
                <tbody>
                  {indentSummary.reimbursements.map((r, idx) => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>{new Date(r.paidAt).toLocaleDateString('en-IN')}</td>
                      <td className="cell-bold">{r.committee}</td>
                      <td>{r.event}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.beneficiaryName || 'Beneficiary'}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.recipientType}</span>
                      </td>
                      <td>
                        <div>{r.paymentMode}</div>
                        {r.paymentReference && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {r.paymentReference}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          background: r.fundingChannel === 'Treasurer Buffer' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: r.fundingChannel === 'Treasurer Buffer' ? '#10b981' : '#3b82f6',
                        }}>
                          {r.fundingChannel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--wc-200)' }}>
                        ₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {r.billsCount || 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <HiOutlineDocumentDownload className="empty-state-icon" />
                <h3 className="empty-state-title">No disbursed claims for {indentMonth}</h3>
                <p className="empty-state-text">Once reimbursements are marked as paid, they will appear here and in the official exported Excel indent.</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ─── Monthly Projections Tab ───────────────────────────────────── */
function ProjectionsTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [totalProjected, setTotalProjected] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // Set deadline form
  const [deadlineForm, setDeadlineForm] = useState({ targetMonth: '', deadline: '', instructions: '' });
  const [settingDeadline, setSettingDeadline] = useState(false);
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);

  const fetchProjections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjections(selectedMonth);
      setProjections(data.projections || []);
      setTotalProjected(data.totalProjectedAmount || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load projections');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchProjections(); }, [fetchProjections]);

  const handleSetDeadline = async (e) => {
    e.preventDefault();
    if (!deadlineForm.targetMonth || !deadlineForm.deadline) {
      toast.error('Target month and deadline are required');
      return;
    }
    setSettingDeadline(true);
    const toastId = toast.loading('Setting projection deadline…');
    try {
      await setProjectionWindow(deadlineForm);
      toast.success(`Deadline set for ${deadlineForm.targetMonth}!`, { id: toastId });
      setDeadlineForm({ targetMonth: '', deadline: '', instructions: '' });
      setShowDeadlineForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set deadline', { id: toastId });
    } finally {
      setSettingDeadline(false);
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>

      {/* ── Monthly Projections Section ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="form-label" htmlFor="proj-month-filter" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>View Projections for Month</label>
          <input
            id="proj-month-filter"
            className="form-input"
            style={{ paddingLeft: '12px', height: '36px', fontSize: '13px' }}
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        <button
          className="btn-secondary"
          onClick={() => setShowDeadlineForm(!showDeadlineForm)}
          style={{ padding: '8px 16px', height: '36px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          id="btn-set-deadline"
        >
          <HiOutlineCalendar />
          Set Submission Deadline
        </button>
      </div>

      {/* Set Deadline Form */}
      {showDeadlineForm && (
        <form className="inline-form animate-fade-in-up" onSubmit={handleSetDeadline} id="set-deadline-form" style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Set Monthly Projection Submission Deadline</h4>
          <div className="form-row-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="deadline-target-month">Target Month (projections for)</label>
              <input
                id="deadline-target-month"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="month"
                value={deadlineForm.targetMonth}
                onChange={(e) => setDeadlineForm((p) => ({ ...p, targetMonth: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="deadline-date">Submission Deadline (Date &amp; Time)</label>
              <input
                id="deadline-date"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="datetime-local"
                value={deadlineForm.deadline}
                onChange={(e) => setDeadlineForm((p) => ({ ...p, deadline: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="deadline-instructions">Instructions for C/DC (optional)</label>
            <input
              id="deadline-instructions"
              className="form-input"
              style={{ paddingLeft: '14px' }}
              type="text"
              placeholder="e.g. Please include all planned events and estimated costs for October"
              value={deadlineForm.instructions}
              onChange={(e) => setDeadlineForm((p) => ({ ...p, instructions: e.target.value }))}
            />
          </div>
          <div className="form-actions" style={{ marginTop: '4px' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowDeadlineForm(false)} disabled={settingDeadline}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={settingDeadline} id="btn-save-deadline">
              {settingDeadline ? <><span className="btn-spinner" /> Saving…</> : 'Save Deadline'}
            </button>
          </div>
        </form>
      )}

      {/* Projections Summary */}
      {!loading && projections.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {projections.length} club{projections.length !== 1 ? 's' : ''} submitted projections for {selectedMonth}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--wc-200)' }}>
            Total: ₹{totalProjected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Projections Table */}
      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : projections.length === 0 ? (
          <div className="empty-state">
            <HiOutlineCalendar className="empty-state-icon" />
            <h3 className="empty-state-title">No projections for {selectedMonth}</h3>
            <p className="empty-state-text">Clubs will submit their monthly expense projections here once a deadline is set.</p>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club / Committee</th>
                <th>Submitted By</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Estimated Total</th>
                <th style={{ textAlign: 'center' }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((proj, i) => (
                <>
                  <tr key={proj.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === proj.id ? null : proj.id)}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                    <td className="cell-bold">{proj.clubName}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {proj.submittedBy?.name}<br />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{proj.submittedBy?.designation === 'CONVENOR' ? 'Convenor' : 'Deputy Convenor'}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${proj.status === 'ACCEPTED' ? 'badge-approved' : proj.status === 'REVIEWED' ? 'badge-pending' : 'badge-query'}`}>
                        {proj.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--wc-200)' }}>
                      ₹{proj.totalEstimatedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {proj.items?.length || 0}
                    </td>
                  </tr>
                  {expandedId === proj.id && proj.items?.length > 0 && (
                    <tr key={`${proj.id}-expanded`}>
                      <td colSpan={6} style={{ background: 'var(--bg-secondary)', padding: '12px 20px' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Event Name</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tentative Date</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Expected Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proj.items.map((item) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-lighter)' }}>
                                <td style={{ padding: '6px 8px' }}>{item.eventName}</td>
                                <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{item.description || '—'}</td>
                                <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>
                                  {item.tentativeDate ? new Date(item.tentativeDate).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>₹{item.expectedAmount?.toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Club Budgets Tab (Treasurer allocates and modifies budget per club per month) ─── */
function ClubBudgetsTab() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [budgets, setBudgets] = useState([]);
  const [knownClubs, setKnownClubs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal form state
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [form, setForm] = useState({
    clubName: '',
    targetMonth: currentMonthStr,
    allocatedAmount: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, budget: null, processing: false });

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getClubBudgets(selectedMonth);
      setBudgets(res.budgets || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load club budgets');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Load known club names to suggest in the modal
  useEffect(() => {
    const fetchClubList = async () => {
      try {
        const mappings = await listClubMappings();
        const names = mappings.map((m) => m.clubName).filter(Boolean);
        setKnownClubs(Array.from(new Set(names)).sort());
      } catch (e) {
        // ignore
      }
    };
    fetchClubList();
  }, []);

  const openAddModal = () => {
    setEditingBudget(null);
    setForm({
      clubName: '',
      targetMonth: selectedMonth,
      allocatedAmount: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setEditingBudget(b);
    setForm({
      clubName: b.clubName,
      targetMonth: b.targetMonth,
      allocatedAmount: b.allocatedAmount,
      notes: b.notes || '',
    });
    setShowModal(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!form.clubName.trim() || !form.targetMonth || form.allocatedAmount === '') {
      toast.error('Please enter club name, month, and budget amount');
      return;
    }
    const amt = parseFloat(form.allocatedAmount);
    if (isNaN(amt) || amt < 0) {
      toast.error('Budget amount must be a positive number');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(editingBudget ? 'Updating club budget…' : 'Allocating club budget…');
    try {
      await upsertClubBudget({
        clubName: form.clubName.trim(),
        targetMonth: form.targetMonth,
        allocatedAmount: amt,
        notes: form.notes,
      });
      toast.success(`Budget of ₹${amt.toLocaleString('en-IN')} ${editingBudget ? 'updated' : 'allocated'} for ${form.clubName}!`, { id: toastId });
      setShowModal(false);
      setEditingBudget(null);
      await fetchBudgets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save club budget', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.budget) return;
    setDeleteModal((p) => ({ ...p, processing: true }));
    const toastId = toast.loading('Removing club budget…');
    try {
      await deleteClubBudget(deleteModal.budget.id);
      toast.success('Club budget removed successfully', { id: toastId });
      setDeleteModal({ open: false, budget: null, processing: false });
      await fetchBudgets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove budget', { id: toastId });
      setDeleteModal((p) => ({ ...p, processing: false }));
    }
  };

  const totalAllocated = useMemo(() => budgets.reduce((sum, b) => sum + b.allocatedAmount, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((sum, b) => sum + b.spentAmount, 0), [budgets]);
  const totalRemaining = Math.max(0, totalAllocated - totalSpent);

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header action bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" htmlFor="budget-month-select" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Budget Month
            </label>
            <input
              id="budget-month-select"
              className="form-input"
              style={{ paddingLeft: '12px', height: '36px', fontSize: '13px', width: '160px' }}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <button
            className="btn-secondary"
            onClick={fetchBudgets}
            style={{ padding: '8px 14px', height: '36px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '18px' }}
            id="btn-refresh-budgets"
          >
            <HiOutlineRefresh /> Refresh
          </button>
        </div>

        <button
          className="btn-primary"
          onClick={openAddModal}
          style={{ padding: '9px 18px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
          id="btn-allocate-budget"
        >
          <HiOutlinePlus /> Allocate / Modify Club Budget
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Allocated</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
            ₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across {budgets.length} club{budgets.length !== 1 ? 's' : ''} in {selectedMonth}
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed / Debited</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--wc-200)', marginTop: '6px' }}>
            ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Debited upon payment clearance
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Balance</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
            ₹{totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Remaining unspent budget
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Utilization</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: totalAllocated > 0 ? (totalSpent / totalAllocated > 0.9 ? '#ef4444' : totalSpent / totalAllocated > 0.75 ? '#f59e0b' : 'var(--wc-200)') : 'var(--text-muted)', marginTop: '6px' }}>
            {totalAllocated > 0 ? `${Math.round((totalSpent / totalAllocated) * 100)}%` : '0%'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Average budget spend
          </div>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="claims-table-wrapper">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
          </div>
        ) : budgets.length === 0 ? (
          <div className="empty-state">
            <TbFileInvoice className="empty-state-icon" />
            <h3 className="empty-state-title">No club budgets allocated for {selectedMonth}</h3>
            <p className="empty-state-text">
              Allocate monthly budgets for Convenors and Deputy Convenors to track and debit reimbursement claims.
            </p>
            <button className="btn-primary" onClick={openAddModal} style={{ marginTop: '12px' }}>
              <HiOutlinePlus /> Allocate First Club Budget
            </button>
          </div>
        ) : (
          <table className="claims-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club / Committee</th>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Allocated Budget</th>
                <th style={{ textAlign: 'right' }}>Disbursed</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th style={{ minWidth: '150px' }}>Utilization</th>
                <th>Notes</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b, i) => {
                const remaining = Math.max(0, b.allocatedAmount - b.spentAmount);
                const percentUsed = b.allocatedAmount > 0 ? Math.min(100, Math.round((b.spentAmount / b.allocatedAmount) * 100)) : 0;
                const barColor = percentUsed >= 95 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : '#10b981';

                return (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                    <td className="cell-bold">{b.clubName}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.targetMonth}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{b.allocatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--wc-200)' }}>
                      ₹{b.spentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: remaining < 1000 ? '#ef4444' : '#10b981' }}>
                      ₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '8px', background: 'var(--border-lighter, #e5e7eb)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentUsed}%`,
                              height: '100%',
                              background: barColor,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: barColor, minWidth: '34px' }}>
                          {percentUsed}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          className="btn-icon"
                          title="Edit budget"
                          onClick={() => openEditModal(b)}
                          id={`btn-edit-budget-${b.id}`}
                        >
                          <HiOutlinePencil />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          title="Delete budget"
                          onClick={() => setDeleteModal({ open: true, budget: b, processing: false })}
                          id={`btn-delete-budget-${b.id}`}
                        >
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Allocate / Edit Modal */}
      {showModal && (
        <div className="details-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="details-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="modal-icon-box">
                  <TbFileInvoice />
                </div>
                <h3 className="modal-title">
                  {editingBudget ? `Edit Budget: ${editingBudget.clubName}` : 'Allocate Club Budget'}
                </h3>
              </div>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <HiOutlineX />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} style={{ padding: '20px 24px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-club-name">
                  Club / Committee Name
                </label>
                <input
                  id="input-club-name"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="text"
                  list="known-clubs-list"
                  placeholder="e.g. Robotics Club, Cultural Committee"
                  value={form.clubName}
                  onChange={(e) => setForm((p) => ({ ...p, clubName: e.target.value }))}
                  required
                />
                <datalist id="known-clubs-list">
                  {knownClubs.map((club) => (
                    <option key={club} value={club} />
                  ))}
                </datalist>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Choose from existing clubs or type a new club/committee name.
                </span>
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="input-budget-month">
                    Target Month
                  </label>
                  <input
                    id="input-budget-month"
                    className="form-input"
                    style={{ paddingLeft: '14px' }}
                    type="month"
                    value={form.targetMonth}
                    onChange={(e) => setForm((p) => ({ ...p, targetMonth: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-budget-amount">
                    Allocated Amount (₹)
                  </label>
                  <input
                    id="input-budget-amount"
                    className="form-input"
                    style={{ paddingLeft: '14px' }}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 25000"
                    value={form.allocatedAmount}
                    onChange={(e) => setForm((p) => ({ ...p, allocatedAmount: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-budget-notes">
                  Notes / Purpose (Optional)
                </label>
                <input
                  id="input-budget-notes"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="text"
                  placeholder="e.g. Annual symposium budget allocation"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  id="btn-save-club-budget"
                >
                  {submitting ? <><span className="btn-spinner" /> Saving…</> : editingBudget ? 'Update Budget' : 'Save Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.budget && (
        <DeleteConfirmModal
          name={`budget for ${deleteModal.budget.clubName} (${deleteModal.budget.targetMonth})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal({ open: false, budget: null, processing: false })}
          processing={deleteModal.processing}
        />
      )}
    </div>
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
              Control users, administrators, club budgets, and the approval hierarchy
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
          {activeTab === 'club-mappings' && <ClubMappingsTab />}
          {activeTab === 'club-budgets' && <ClubBudgetsTab />}
          {activeTab === 'buffer' && <BufferTab />}
          {activeTab === 'indent' && <IndentTab />}
          {activeTab === 'projections' && <ProjectionsTab />}
        </section>
      </main>
    </div>
  );
}

export default ManageUsers;
