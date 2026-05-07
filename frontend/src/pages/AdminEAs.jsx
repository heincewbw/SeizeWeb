import { useEffect, useState } from 'react';
import { adminAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

const emptyForm = {
  name: '',
  tagline: '',
  description: '',
  myfxbook_url: '',
  widget_url: '',
  widget_link: '',
  tracking_start: '',
  tags: '',
  status: 'Available',
  is_active: true,
  sort_order: 0,
};

export default function AdminEAs() {
  const [eas, setEAs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.listEAs();
      setEAs(data.eas || []);
    } catch {
      toast.error('Failed to load EAs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (ea) => {
    setEditing(ea);
    setForm({
      name: ea.name || '',
      tagline: ea.tagline || '',
      description: ea.description || '',
      myfxbook_url: ea.myfxbook_url || '',
      widget_url: ea.widget_url || '',
      widget_link: ea.widget_link || '',
      tracking_start: ea.tracking_start ? ea.tracking_start.slice(0, 10) : '',
      tags: (ea.tags || []).join(', '),
      status: ea.status || 'Available',
      is_active: !!ea.is_active,
      sort_order: ea.sort_order ?? 0,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama EA wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        tracking_start: form.tracking_start || null,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (editing) {
        await adminAPI.updateEA(editing.id, payload);
        toast.success('EA updated');
      } else {
        await adminAPI.createEA(payload);
        toast.success('EA created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ea) => {
    if (!window.confirm(`Hapus EA "${ea.name}"?`)) return;
    try {
      await adminAPI.deleteEA(ea.id);
      toast.success('EA deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Manage EAs</h2>
          <p className="text-sm text-slate-400 mt-0.5">{eas.length} expert advisor(s)</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Add EA
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {['Sort', 'Name', 'Tagline', 'Status', 'Active', 'Tracking Start', 'Tags', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">Loading...</td></tr>
              ) : eas.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">No EAs yet</td></tr>
              ) : (
                eas.map((ea) => (
                  <tr key={ea.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400">{ea.sort_order}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{ea.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{ea.tagline || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{ea.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ea.is_active ? (
                        <span className="text-brand-400 font-semibold">Yes</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{ea.tracking_start ? ea.tracking_start.slice(0, 10) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{(ea.tags || []).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(ea)} className="btn-secondary px-2 py-1 text-xs mr-2">
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(ea)} className="btn-secondary px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-400">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-dark-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-dark-900">
              <h3 className="text-lg font-semibold text-slate-100">{editing ? 'Edit EA' : 'Add EA'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name *</label>
                  <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tagline</label>
                  <input className="input-field" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Myfxbook URL</label>
                <input className="input-field" placeholder="https://www.myfxbook.com/portfolio/..." value={form.myfxbook_url} onChange={(e) => setForm({ ...form, myfxbook_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Widget Image URL</label>
                  <input className="input-field" placeholder="https://widget.myfxbook.com/widget/widget.png?accountOid=..." value={form.widget_url} onChange={(e) => setForm({ ...form, widget_url: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Widget Link URL</label>
                  <input className="input-field" placeholder="https://www.myfxbook.com/members/..." value={form.widget_link} onChange={(e) => setForm({ ...form, widget_link: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tracking Start</label>
                  <input type="date" className="input-field" value={form.tracking_start} onChange={(e) => setForm({ ...form, tracking_start: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <input className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sort Order</label>
                  <input type="number" className="input-field" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tags (comma separated)</label>
                <input className="input-field" placeholder="Forex, Momentum, Multi-Pair" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input id="is_active" type="checkbox" className="w-4 h-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="is_active" className="text-sm text-slate-300">Active (visible to investors)</label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
