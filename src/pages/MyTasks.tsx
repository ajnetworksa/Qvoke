import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useERPStore } from '../store';
import { PersonalTask } from '../types';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit3,
  X,
  Circle,
  CheckCircle2,
  Clock,
  Flag,
  Calendar,
  Loader2,
  Check
} from 'lucide-react';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';

const PRIORITY_META: Record<PersonalTask['priority'], { label: string; cls: string }> = {
  high: { label: 'High', cls: 'text-red-600 bg-red-500/10 border-red-500/20' },
  normal: { label: 'Normal', cls: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20' },
  low: { label: 'Low', cls: 'text-[var(--color-text-muted)] bg-[var(--color-surface-offset)] border-[var(--color-border)]' }
};

const STATUS_META: Record<PersonalTask['status'], { label: string; icon: React.ElementType; cls: string }> = {
  open: { label: 'Open', icon: Circle, cls: 'text-[var(--color-text-muted)]' },
  in_progress: { label: 'In Progress', icon: Clock, cls: 'text-amber-600' },
  done: { label: 'Done', icon: CheckCircle2, cls: 'text-emerald-600' }
};

const emptyForm = (): Partial<PersonalTask> => ({
  title: '',
  notes: '',
  status: 'open',
  priority: 'normal',
  dueDate: ''
});

export const MyTasks: React.FC = () => {
  const { tasks, fetchTasks, addTask, updateTask, deleteTask } = useERPStore();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PersonalTask>>(emptyForm());
  const [autoSave, setAutoSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEditId = useRef<string | null>(null); // skip the first change right after opening

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Autosave edits to an existing task (debounced). Creating a task stays explicit.
  useEffect(() => {
    if (!formOpen || !editId) return;
    if (skipEditId.current === editId) { skipEditId.current = null; return; }
    if (!form.title || !form.title.trim()) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutoSave('saving');
    autosaveTimer.current = setTimeout(async () => {
      await updateTask(editId, {
        title: form.title!.trim(),
        notes: form.notes?.trim() || null,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null
      });
      setAutoSave('saved');
      setTimeout(() => setAutoSave((s) => (s === 'saved' ? 'idle' : s)), 2000);
    }, 800);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [form, formOpen, editId, updateTask]);

  const filtered = useMemo(
    () => (filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  const counts = useMemo(() => ({
    all: tasks.length,
    open: tasks.filter((t) => t.status === 'open').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length
  }), [tasks]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (t: PersonalTask) => {
    skipEditId.current = t.id; // don't autosave the initial populate
    setAutoSave('idle');
    setEditId(t.id);
    setForm({
      title: t.title,
      notes: t.notes || '',
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : ''
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.title.trim()) return;
    const payload: Partial<PersonalTask> = {
      title: form.title.trim(),
      notes: form.notes?.trim() || null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null
    };
    if (editId) {
      // Edits autosave continuously; flush any pending timer and close.
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      await updateTask(editId, payload);
    } else {
      await addTask(payload);
    }
    setFormOpen(false);
  };

  // Cycle a task's status with a single click on its status icon.
  const cycleStatus = (t: PersonalTask) => {
    const next: PersonalTask['status'] =
      t.status === 'open' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'open';
    updateTask(t.id, { status: next });
  };

  const isOverdue = (t: PersonalTask) =>
    t.status !== 'done' && t.dueDate && new Date(String(t.dueDate)) < new Date(new Date().toDateString());

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'done', label: 'Done' }
  ];

  return (
    <div className="animate-fade-in text-left">
      <PageHeader
        title="My Tasks / مهامي"
        breadcrumbs={[{ label: 'Home' }, { label: 'My Tasks' }]}
        actions={
          <button
            onClick={openCreate}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold py-2.5 px-4 rounded-md flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Task / مهمة جديدة
          </button>
        }
      />

      {/* Status filter tabs */}
      <div className="premium-card p-2 mb-6 flex items-center gap-1 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === tab.key
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-offset)]'
            }`}
          >
            {tab.label}
            <span className="text-[10px] font-black bg-[var(--color-surface-offset)] px-1.5 py-0.5 rounded-full">
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={filter === 'all' ? 'No tasks yet' : `No ${filter.replace('_', ' ')} tasks`}
          description="Track your personal to-dos and pending work items. Set priorities and due dates to stay on top of follow-ups."
          actionText="Create Task"
          onAction={openCreate}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((t) => {
            const StatusIcon = STATUS_META[t.status].icon;
            const overdue = isOverdue(t);
            return (
              <div
                key={t.id}
                className={`premium-card p-4 flex items-start gap-3 transition-all duration-[var(--transition-interactive)] hover:border-[var(--color-primary)]/40 hover:shadow-sm ${
                  t.status === 'done' ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => cycleStatus(t)}
                  title={`Status: ${STATUS_META[t.status].label} (click to advance)`}
                  className={`mt-0.5 shrink-0 ${STATUS_META[t.status].cls} hover:scale-110 transition-transform cursor-pointer`}
                >
                  <StatusIcon className="w-5 h-5" />
                </button>

                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-bold text-[var(--color-text)] ${
                      t.status === 'done' ? 'line-through' : ''
                    }`}
                  >
                    {t.title}
                  </h3>
                  {t.notes && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 whitespace-pre-wrap">{t.notes}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${PRIORITY_META[t.priority].cls}`}
                    >
                      <Flag className="w-3 h-3" />
                      {PRIORITY_META[t.priority].label}
                    </span>
                    {t.dueDate && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          overdue
                            ? 'text-red-600 bg-red-500/10 border-red-500/20'
                            : 'text-[var(--color-text-muted)] bg-[var(--color-surface-offset)] border-[var(--color-border)]'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {overdue ? 'Overdue · ' : ''}
                        {String(t.dueDate).slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-2 hover:bg-[var(--color-surface-offset)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    title="Edit Task"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this task?')) deleteTask(t.id);
                    }}
                    className="p-2 hover:bg-[var(--color-error)]/10 rounded text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFormOpen(false)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-6 overflow-hidden animate-slide-in text-left flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />
                {editId ? 'Edit Task / تعديل المهمة' : 'New Task / مهمة جديدة'}
                {editId && autoSave === 'saving' && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)]"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
                )}
                {editId && autoSave === 'saved' && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500"><Check className="w-3 h-3" /> Saved</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 hover:bg-[var(--color-surface-offset)] rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Title *</label>
              <input
                type="text"
                required
                autoFocus
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full premium-input text-sm text-[var(--color-text)] font-semibold"
                placeholder="e.g. Follow up with client on QT-000931"
              />
            </div>

            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full premium-input text-sm text-[var(--color-text)] resize-none"
                placeholder="Optional details…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
              <div>
                <label className="block mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as PersonalTask['priority'] })}
                  className="w-full premium-input"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PersonalTask['status'] })}
                  className="w-full premium-input"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-semibold text-[var(--color-text-muted)]">
              <label className="block mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate ? String(form.dueDate).slice(0, 10) : ''}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full premium-input text-sm text-[var(--color-text)]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-[var(--color-divider)]/40 pt-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-offset)] rounded-md text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors cursor-pointer"
              >
                {editId ? 'Done' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
