import { useState, useEffect, useCallback, Fragment, type FormEvent } from 'react';
import { leaveTypesApi } from '../api/phase3_endpoints';
import { formatApiError } from '../constants/roles';

const LEAVE_SCHEMES = ['CCS', 'RESIDENCY', 'BOTH'] as const;

export type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  scheme: string;
  is_accumulating?: boolean;
  max_accumulation?: number | null;
  requires_mc?: boolean;
  min_days_for_mc?: number | null;
  count_holidays?: boolean;
  is_half_day_allowed?: boolean;
  carry_forward?: boolean;
  encashable?: boolean;
  validation_rules?: Record<string, unknown> | null;
  is_active?: boolean;
};

type ValidationRuleFields = {
  no_prefix_suffix_holidays: boolean;
  no_prefix_suffix_weekends: boolean;
  no_combination: boolean;
  max_per_stretch: string;
  max_absence_span: string;
  min_notice_days: string;
};

type LeaveTypeDraft = {
  name: string;
  scheme: string;
  is_accumulating: boolean;
  max_accumulation: string;
  requires_mc: boolean;
  min_days_for_mc: string;
  count_holidays: boolean;
  is_half_day_allowed: boolean;
  carry_forward: boolean;
  encashable: boolean;
  validation: ValidationRuleFields;
  is_active: boolean;
};

function normalizeValidationRules(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function rulesToFields(rules: Record<string, unknown> | null): ValidationRuleFields {
  return {
    no_prefix_suffix_holidays: Boolean(rules?.no_prefix_suffix_holidays),
    no_prefix_suffix_weekends: Boolean(rules?.no_prefix_suffix_weekends),
    no_combination: Boolean(rules?.no_combination),
    max_per_stretch: rules?.max_per_stretch != null ? String(rules.max_per_stretch) : '',
    max_absence_span: rules?.max_absence_span != null ? String(rules.max_absence_span) : '',
    min_notice_days: rules?.min_notice_days != null ? String(rules.min_notice_days) : '',
  };
}

function fieldsToRules(fields: ValidationRuleFields): Record<string, unknown> | null {
  const rules: Record<string, unknown> = {};
  if (fields.no_prefix_suffix_holidays) rules.no_prefix_suffix_holidays = true;
  if (fields.no_prefix_suffix_weekends) rules.no_prefix_suffix_weekends = true;
  if (fields.no_combination) rules.no_combination = true;
  const maxStretch = fields.max_per_stretch.trim();
  if (maxStretch) {
    const n = Number(maxStretch);
    if (Number.isFinite(n)) rules.max_per_stretch = Math.trunc(n);
  }
  const maxAbsence = fields.max_absence_span.trim();
  if (maxAbsence) {
    const n = Number(maxAbsence);
    if (Number.isFinite(n)) rules.max_absence_span = Math.trunc(n);
  }
  const minNotice = fields.min_notice_days.trim();
  if (minNotice) {
    const n = Number(minNotice);
    if (Number.isFinite(n)) rules.min_notice_days = Math.trunc(n);
  }
  return Object.keys(rules).length > 0 ? rules : null;
}

function leaveTypeToDraft(lt: LeaveTypeRow): LeaveTypeDraft {
  return {
    name: lt.name,
    scheme: lt.scheme,
    is_accumulating: Boolean(lt.is_accumulating),
    max_accumulation: lt.max_accumulation != null ? String(lt.max_accumulation) : '',
    requires_mc: Boolean(lt.requires_mc),
    min_days_for_mc: lt.min_days_for_mc != null ? String(lt.min_days_for_mc) : '',
    count_holidays: lt.count_holidays !== false,
    is_half_day_allowed: Boolean(lt.is_half_day_allowed),
    carry_forward: Boolean(lt.carry_forward),
    encashable: Boolean(lt.encashable),
    validation: rulesToFields(normalizeValidationRules(lt.validation_rules)),
    is_active: lt.is_active !== false,
  };
}

function emptyLeaveTypeDraft(): LeaveTypeDraft {
  return {
    name: '',
    scheme: 'CCS',
    is_accumulating: false,
    max_accumulation: '',
    requires_mc: false,
    min_days_for_mc: '',
    count_holidays: true,
    is_half_day_allowed: false,
    carry_forward: false,
    encashable: false,
    validation: rulesToFields(null),
    is_active: true,
  };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function leaveDraftToPayload(draft: LeaveTypeDraft) {
  return {
    name: draft.name.trim(),
    scheme: draft.scheme,
    is_accumulating: draft.is_accumulating,
    max_accumulation: parseOptionalInt(draft.max_accumulation),
    requires_mc: draft.requires_mc,
    min_days_for_mc: parseOptionalInt(draft.min_days_for_mc),
    count_holidays: draft.count_holidays,
    is_half_day_allowed: draft.is_half_day_allowed,
    carry_forward: draft.carry_forward,
    encashable: draft.encashable,
    validation_rules: fieldsToRules(draft.validation),
    is_active: draft.is_active,
  };
}

function BoolField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-slate-300" />
      {label}
    </label>
  );
}

function ValidationRulesEditor({
  validation,
  onChange,
  leaveCode,
}: {
  validation: ValidationRuleFields;
  onChange: (next: ValidationRuleFields) => void;
  leaveCode?: string;
}) {
  const patch = (partial: Partial<ValidationRuleFields>) => onChange({ ...validation, ...partial });
  const isCl = leaveCode === 'CL';

  return (
    <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">Validation rules</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          {isCl
            ? 'CL (DoPT): weekends/holidays may attach without debit; block sandwich with EL/HPL; cap total absence span.'
            : 'Optional checks applied when staff apply for this leave type.'}
        </p>
      </div>
      {!isCl && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <BoolField label="Block leave before/after holidays" checked={validation.no_prefix_suffix_holidays} onChange={(v) => patch({ no_prefix_suffix_holidays: v })} />
          <BoolField label="Block leave before/after weekends" checked={validation.no_prefix_suffix_weekends} onChange={(v) => patch({ no_prefix_suffix_weekends: v })} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <BoolField
          label={isCl ? 'Block sandwich with EL/HPL/EOL (DoPT)' : 'Cannot combine with other leave'}
          checked={validation.no_combination}
          onChange={(v) => patch({ no_combination: v })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
        <div>
          <label className="form-label">Max debited days per stretch</label>
          <input type="number" value={validation.max_per_stretch} onChange={(e) => patch({ max_per_stretch: e.target.value })} className="form-input" placeholder={isCl ? '8 for CL' : 'e.g. 5'} />
        </div>
        {isCl && (
          <div>
            <label className="form-label">Max absence span (calendar days)</label>
            <input type="number" value={validation.max_absence_span} onChange={(e) => patch({ max_absence_span: e.target.value })} className="form-input" placeholder="8 incl. weekends/holidays" />
          </div>
        )}
        <div>
          <label className="form-label">Minimum notice (days)</label>
          <input type="number" value={validation.min_notice_days} onChange={(e) => patch({ min_notice_days: e.target.value })} className="form-input" placeholder="e.g. 3 for EL" />
        </div>
      </div>
    </div>
  );
}

function LeaveTypeEditor({
  draft,
  onChange,
  code,
  readOnlyCode,
}: {
  draft: LeaveTypeDraft;
  onChange: (next: LeaveTypeDraft) => void;
  code?: string;
  readOnlyCode?: boolean;
}) {
  const patch = (partial: Partial<LeaveTypeDraft>) => onChange({ ...draft, ...partial });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {readOnlyCode && (
        <div>
          <label className="form-label">Code</label>
          <input value={code || ''} readOnly className="form-input bg-slate-50 font-mono" />
        </div>
      )}
      <div>
        <label className="form-label">Name *</label>
        <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className="form-input" required />
      </div>
      <div>
        <label className="form-label">Scheme</label>
        <select value={draft.scheme} onChange={(e) => patch({ scheme: e.target.value })} className="form-select">
          {LEAVE_SCHEMES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Max Accumulation</label>
        <input
          type="number"
          value={draft.max_accumulation}
          onChange={(e) => patch({ max_accumulation: e.target.value })}
          className="form-input"
          placeholder="e.g. 300 for EL"
        />
      </div>
      <div>
        <label className="form-label">Min Days for MC</label>
        <input
          type="number"
          value={draft.min_days_for_mc}
          onChange={(e) => patch({ min_days_for_mc: e.target.value })}
          className="form-input"
          placeholder="e.g. 3 for HPL"
        />
      </div>
      <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-x-6 gap-y-2 pt-1">
        <BoolField label="Accumulating balance" checked={draft.is_accumulating} onChange={(v) => patch({ is_accumulating: v })} />
        <BoolField label="Requires medical certificate" checked={draft.requires_mc} onChange={(v) => patch({ requires_mc: v })} />
        <BoolField label="Count holidays in leave" checked={draft.count_holidays} onChange={(v) => patch({ count_holidays: v })} />
        <BoolField label="Half-day allowed" checked={draft.is_half_day_allowed} onChange={(v) => patch({ is_half_day_allowed: v })} />
        <BoolField label="Carry forward" checked={draft.carry_forward} onChange={(v) => patch({ carry_forward: v })} />
        <BoolField label="Encashable" checked={draft.encashable} onChange={(v) => patch({ encashable: v })} />
        <BoolField label="Active" checked={draft.is_active} onChange={(v) => patch({ is_active: v })} />
      </div>
      <ValidationRulesEditor validation={draft.validation} onChange={(validation) => patch({ validation })} leaveCode={code} />
    </div>
  );
}

function validationSummary(rules: Record<string, unknown> | null, code?: string): string {
  const fields = rulesToFields(rules);
  const isCl = code === 'CL';
  const parts: string[] = [];
  if (fields.no_prefix_suffix_holidays) parts.push('No holiday prefix/suffix');
  if (fields.no_prefix_suffix_weekends) parts.push('No weekend prefix/suffix');
  if (fields.no_combination) parts.push(isCl ? 'No EL/HPL sandwich' : 'No combination');
  if (fields.max_per_stretch) parts.push(`Max ${fields.max_per_stretch} debited`);
  if (fields.max_absence_span) parts.push(`${fields.max_absence_span}d absence span`);
  if (fields.min_notice_days) parts.push(`${fields.min_notice_days}d notice`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function LeaveTypesPanel() {
  const [items, setItems] = useState<LeaveTypeRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LeaveTypeDraft | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createDraft, setCreateDraft] = useState<LeaveTypeDraft>(emptyLeaveTypeDraft);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await leaveTypesApi.list({ include_inactive: true });
    setItems(data as LeaveTypeRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (lt: LeaveTypeRow) => {
    setEditingId(lt.id);
    setEditDraft(leaveTypeToDraft(lt));
    setShowCreateForm(false);
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft) return;
    setSaving(true);
    setMessage('');
    try {
      await leaveTypesApi.update(editingId, leaveDraftToPayload(editDraft));
      setMessage('Leave type saved.');
      cancelEdit();
      await load();
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail)
        || 'Failed to save leave type.');
    } finally {
      setSaving(false);
    }
  };

  const createLeaveType = async (e: FormEvent) => {
    e.preventDefault();
    if (!createCode.trim() || !createDraft.name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = leaveDraftToPayload(createDraft);
      await leaveTypesApi.create({ code: createCode.trim().toUpperCase(), ...payload });
      setCreateCode('');
      setCreateDraft(emptyLeaveTypeDraft());
      setShowCreateForm(false);
      setMessage('Leave type created.');
      await load();
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail)
        || 'Failed to create leave type.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setShowCreateForm((v) => !v); cancelEdit(); }}
          className="btn-primary btn-sm"
        >
          {showCreateForm ? 'Cancel' : '+ Add Leave Type'}
        </button>
      </div>

      {showCreateForm && (
        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">New Leave Type</h3>
          <form onSubmit={createLeaveType} className="space-y-4">
            <div className="max-w-xs">
              <label className="form-label">Code *</label>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                className="form-input font-mono"
                placeholder="e.g. EL"
                maxLength={20}
                required
              />
            </div>
            <LeaveTypeEditor draft={createDraft} onChange={setCreateDraft} />
            <button type="submit" disabled={saving} className="btn-primary">Create Leave Type</button>
          </form>
        </div>
      )}

      <div className="overflow-hidden border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Scheme</th>
              <th>Validation</th>
              <th className="text-center">Half-Day</th>
              <th className="text-center">MC</th>
              <th className="text-center">Carry Fwd</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lt) => (
              <Fragment key={lt.id}>
                <tr className={lt.is_active === false ? 'opacity-60' : ''}>
                  <td className="font-mono font-medium">{lt.code}</td>
                  <td>{lt.name}</td>
                  <td><span className="badge badge-blue">{lt.scheme}</span></td>
                  <td className="text-xs text-slate-500 max-w-[200px]">{validationSummary(normalizeValidationRules(lt.validation_rules), lt.code)}</td>
                  <td className="text-center">{lt.is_half_day_allowed ? '✓' : '—'}</td>
                  <td className="text-center">{lt.requires_mc ? '✓' : '—'}</td>
                  <td className="text-center">{lt.carry_forward ? '✓' : '—'}</td>
                  <td>{lt.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    {editingId === lt.id ? (
                      <>
                        <button type="button" onClick={() => void saveEdit()} disabled={saving} className="text-xs font-bold text-emerald-700 hover:underline mr-3">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:underline">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => startEdit(lt)} className="text-xs font-bold text-blue-600 hover:underline">Manage</button>
                    )}
                  </td>
                </tr>
                {editingId === lt.id && editDraft && (
                  <tr>
                    <td colSpan={9} className="bg-slate-50 p-4 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Edit {lt.code}</h4>
                      <LeaveTypeEditor draft={editDraft} onChange={setEditDraft} code={lt.code} readOnlyCode />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-slate-400">No leave types configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Credit frequency (e.g. EL credited 15 days at each calendar half) is set under{' '}
        <strong>Masters → Entitlements</strong> or <strong>Admin → Leave Policy Matrix</strong>.
      </p>
    </div>
  );
}
