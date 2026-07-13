import { useCallback, useEffect, useMemo, useState } from 'react';
import { entitlementRulesApi, leaveTypesApi } from '../api/endpoints';
import {
  ELIGIBILITY_OPTIONS,
  POLICY_CATEGORY_CODES,
  buildSpecialRules,
  ensurePolicyDraft,
  isPolicyCategoryCode,
  leaveTypeAppliesToCategory,
  parseOptionalNumber,
  type EntitlementRule,
  type LeaveTypeOption,
  type PolicyCategoryCode,
  type PolicyRowDraft,
} from '../utils/leavePolicy';

type EntitlementRulesPanelProps = {
  initialCategory?: string | null;
};

export function EntitlementRulesPanel({ initialCategory }: EntitlementRulesPanelProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [entitlementRules, setEntitlementRules] = useState<EntitlementRule[]>([]);
  const [activeCategory, setActiveCategory] = useState<PolicyCategoryCode>(
    isPolicyCategoryCode(initialCategory) ? initialCategory : 'FACULTY',
  );
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyRowDraft>>({});
  const [savingPolicyKey, setSavingPolicyKey] = useState('');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPolicyCategoryCode(initialCategory)) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [ltRes, rulesRes] = await Promise.all([
        leaveTypesApi.list({ include_inactive: true }),
        entitlementRulesApi.list(),
      ]);
      setLeaveTypes(ltRes.data || []);
      setEntitlementRules(rulesRes.data || []);
    } catch {
      setLoadError('Could not load leave policy. Run `cd backend && python seeds/run.py`, then refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const entitlementRuleMap = useMemo(() => {
    const entries = entitlementRules.map(
      (rule) => [`${rule.category_code}::${rule.leave_type_code}`, rule] as const,
    );
    return new Map<string, EntitlementRule>(entries);
  }, [entitlementRules]);

  const updatePolicyDraft = (draftKey: string, updater: (current: PolicyRowDraft) => PolicyRowDraft) => {
    setPolicyDrafts((current) => {
      const leaveType = leaveTypes.find((item) => `${activeCategory}::${item.code}` === draftKey);
      const rule = entitlementRuleMap.get(draftKey);
      const fallback = leaveType
        ? ensurePolicyDraft(leaveType, rule)
        : ensurePolicyDraft({ id: '', code: '', name: '', scheme: 'CCS' }, rule);
      return { ...current, [draftKey]: updater(current[draftKey] || fallback) };
    });
  };

  const policyRows = useMemo(
    () => leaveTypes
      .filter((leaveType) => leaveType.is_active !== false && leaveTypeAppliesToCategory(leaveType, activeCategory))
      .map((leaveType) => {
        const rule = entitlementRuleMap.get(`${activeCategory}::${leaveType.code}`);
        return {
          id: leaveType.id,
          code: leaveType.code,
          name: leaveType.name,
          status: rule ? 'Configured' : 'Missing',
          statusTone: rule ? 'ok' as const : 'warn' as const,
        };
      }),
    [activeCategory, entitlementRuleMap, leaveTypes],
  );

  const initializePolicyRow = async (rowCode: string) => {
    setSavingPolicyKey(`${activeCategory}::${rowCode}`);
    try {
      await entitlementRulesApi.create({
        category_code: activeCategory,
        leave_type_code: rowCode,
        year_ref: 'CALENDAR',
        credit_frequency: 'ANNUAL',
      });
      const rulesRes = await entitlementRulesApi.list();
      setEntitlementRules(rulesRes.data || []);
      setMessage(`Initialized ${rowCode} for ${activeCategory}. Configure and save.`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage(`Could not initialize ${rowCode}.`);
    } finally {
      setSavingPolicyKey('');
    }
  };

  const savePolicyRow = async (rowCode: string) => {
    const draftKey = `${activeCategory}::${rowCode}`;
    const leaveType = leaveTypes.find((item) => item.code === rowCode);
    const rule = entitlementRuleMap.get(draftKey);
    if (!leaveType || !rule) {
      setMessage(`No rule exists for ${rowCode}. Click Initialize first.`);
      return;
    }

    const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
    setSavingPolicyKey(draftKey);
    try {
      const isTenure = draft.yearRef === 'TENURE';
      await entitlementRulesApi.update(rule.id, {
        year_ref: draft.yearRef,
        days_per_year: isTenure ? null : parseOptionalNumber(draft.annualCredit),
        credit_frequency: isTenure ? 'NONE' : draft.creditFrequency,
        max_at_a_stretch: parseOptionalNumber(draft.maxAtATime),
        max_in_tenure: parseOptionalNumber(draft.maxInTenure),
        special_rules: buildSpecialRules(draft),
      });
      await leaveTypesApi.update(leaveType.id, {
        max_accumulation: parseOptionalNumber(draft.maxAccumulation),
      });
      const [rulesRes, ltRes] = await Promise.all([
        entitlementRulesApi.list(),
        leaveTypesApi.list({ include_inactive: true }),
      ]);
      setEntitlementRules(rulesRes.data || []);
      setLeaveTypes(ltRes.data || []);
      setMessage(`Saved ${rowCode}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save policy.');
    } finally {
      setSavingPolicyKey('');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-8 text-center">Loading leave policy…</p>;
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div>
      )}
      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-1">
        <p>
          <strong>EL</strong> and <strong>HPL</strong> are credited <strong>half-yearly</strong> (15+15 and 10+10 days).
          {' '}<strong>ML / PL / CCL</strong> use a <strong>tenure pool</strong> with optional gender and max-times rules.
        </p>
        <p className="text-xs text-slate-500">
          Leave type behaviour (half-day, sandwich rules) is configured under Leave Types.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
        {POLICY_CATEGORY_CODES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              activeCategory === category ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            {category.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="data-table min-w-full whitespace-nowrap">
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Year Basis</th>
                <th>Days / Yr</th>
                <th>Credit Freq.</th>
                <th className="text-center">Max Stretch</th>
                <th className="text-center">Max Tenure</th>
                <th className="text-center">Max Times</th>
                <th>Eligibility</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policyRows.map((row) => {
                const draftKey = `${activeCategory}::${row.code}`;
                const rule = entitlementRuleMap.get(draftKey);
                const leaveType = leaveTypes.find((item) => item.code === row.code)!;
                const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
                const isTenure = draft.yearRef === 'TENURE';
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="font-mono text-xs font-bold">{row.code}</div>
                      <div className="text-xs text-slate-500 max-w-[140px] whitespace-normal">{row.name}</div>
                    </td>
                    <td>
                      <select
                        value={draft.yearRef}
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, yearRef: e.target.value }))}
                        disabled={!rule}
                        className="form-select text-xs py-1.5 min-w-[6.5rem] disabled:opacity-50"
                      >
                        <option value="CALENDAR">Calendar</option>
                        <option value="TENURE">Tenure / service</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        value={isTenure ? '' : draft.annualCredit}
                        disabled={!rule || isTenure}
                        placeholder={isTenure ? '—' : '30'}
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, annualCredit: e.target.value }))}
                        className="form-input w-20 text-sm py-1.5 disabled:bg-slate-100"
                      />
                      {draft.creditFrequency === 'HALF_YEARLY' && draft.annualCredit && !isTenure && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{Number(draft.annualCredit) / 2}/half</div>
                      )}
                    </td>
                    <td>
                      {isTenure ? (
                        <span className="text-xs text-slate-600">Tenure pool</span>
                      ) : (
                        <select
                          value={draft.creditFrequency}
                          disabled={!rule}
                          onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, creditFrequency: e.target.value }))}
                          className="form-select text-xs py-1.5 min-w-[7rem] disabled:opacity-50"
                        >
                          <option value="ANNUAL">Annual</option>
                          <option value="HALF_YEARLY">Half-yearly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      )}
                    </td>
                    <td className="text-center">
                      <input
                        type="number"
                        value={draft.maxAtATime}
                        disabled={!rule}
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxAtATime: e.target.value }))}
                        className="form-input w-16 text-sm py-1.5 disabled:opacity-50"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="number"
                        step="0.5"
                        value={draft.maxInTenure}
                        disabled={!rule}
                        placeholder={isTenure ? '180' : '—'}
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxInTenure: e.target.value }))}
                        className="form-input w-20 text-sm py-1.5 disabled:opacity-50"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="number"
                        value={draft.maxTimesInService}
                        disabled={!rule}
                        placeholder="2"
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxTimesInService: e.target.value }))}
                        className="form-input w-14 text-sm py-1.5 disabled:opacity-50"
                      />
                    </td>
                    <td>
                      <select
                        value={draft.eligibility}
                        disabled={!rule}
                        onChange={(e) => updatePolicyDraft(draftKey, (c) => ({
                          ...c,
                          eligibility: e.target.value as PolicyRowDraft['eligibility'],
                        }))}
                        className="form-select text-xs py-1.5 min-w-[6.5rem] disabled:opacity-50"
                      >
                        {ELIGIBILITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        row.statusTone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {row.statusTone === 'ok' ? (
                        <button
                          type="button"
                          disabled={savingPolicyKey === draftKey}
                          onClick={() => void savePolicyRow(row.code)}
                          className="btn-primary btn-sm disabled:opacity-50"
                        >
                          {savingPolicyKey === draftKey ? 'Saving…' : 'Save'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={savingPolicyKey === draftKey}
                          onClick={() => void initializePolicyRow(row.code)}
                          className="btn-secondary btn-sm disabled:opacity-50"
                        >
                          Initialize
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {policyRows.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-slate-400">No applicable leave types for this category.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
