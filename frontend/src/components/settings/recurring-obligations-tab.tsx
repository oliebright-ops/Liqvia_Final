'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import type {
  ObligationCategory,
  ObligationFrequency,
  RecurringObligationView,
} from '@/lib/module-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTable } from '@/components/ui/financial-table';

const CATEGORIES: ObligationCategory[] = [
  'payroll',
  'superannuation',
  'payg_withholding',
  'gst_bas',
  'rent',
  'loan_repayment',
  'insurance',
  'subscription',
  'other',
];

const FREQUENCIES: ObligationFrequency[] = [
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'annually',
];

interface FormValues {
  name: string;
  category: ObligationCategory;
  amount: number;
  frequency: ObligationFrequency;
  nextDueDate: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  name: '',
  category: 'payroll',
  amount: 0,
  frequency: 'monthly',
  nextDueDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

function fieldClass() {
  return 'w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
}

export function RecurringObligationsTab() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const ro = (t.modules as Record<string, Record<string, unknown>>).recurringObligations as Record<
    string,
    string
  >;
  const [obligations, setObligations] = useState<RecurringObligationView[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: EMPTY_FORM });

  const load = useCallback(() => {
    apiGet<RecurringObligationView[]>('/recurring-obligations')
      .then(setObligations)
      .catch(() => setObligations([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      category: values.category,
      amount: Number(values.amount),
      frequency: values.frequency,
      nextDueDate: values.nextDueDate,
      notes: values.notes || null,
    };
    if (editingId) {
      await apiPatch(`/recurring-obligations/${editingId}`, payload);
    } else {
      await apiPost('/recurring-obligations', payload);
    }
    form.reset(EMPTY_FORM);
    setEditingId(null);
    load();
  }

  function edit(o: RecurringObligationView) {
    setEditingId(o.id);
    form.reset({
      name: o.name,
      category: o.category,
      amount: o.amount,
      frequency: o.frequency,
      nextDueDate: o.nextDueDate,
      notes: o.notes ?? '',
    });
  }

  async function remove(id: string) {
    await apiDelete(`/recurring-obligations/${id}`);
    if (editingId === id) {
      setEditingId(null);
      form.reset(EMPTY_FORM);
    }
    load();
  }

  return (
    <div className="space-y-4">
      {obligations.length === 0 ? (
        <EmptyState title={ro.emptyTitle} description={ro.emptyHint} />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <FinancialTable
              rows={obligations}
              rowKey={(o) => o.id}
              columns={[
                { key: 'name', header: ro.colName, render: (o) => o.name },
                {
                  key: 'category',
                  header: ro.colCategory,
                  render: (o) => <Badge variant="muted">{ro[`category_${o.category}`] ?? o.category}</Badge>,
                },
                {
                  key: 'amount',
                  header: ro.colAmount,
                  align: 'right',
                  mono: true,
                  render: (o) => o.amount.toLocaleString(),
                },
                {
                  key: 'frequency',
                  header: ro.colFrequency,
                  muted: true,
                  render: (o) => ro[`frequency_${o.frequency}`] ?? o.frequency,
                },
                {
                  key: 'nextDueDate',
                  header: ro.colNextDue,
                  mono: true,
                  render: (o) => o.nextDueDate,
                },
                ...(isAdmin
                  ? [
                      {
                        key: 'actions',
                        header: '',
                        render: (o: RecurringObligationView) => (
                          <div className="flex gap-2">
                            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => edit(o)}>
                              {ro.edit}
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs text-cash-negative"
                              onClick={() => void remove(o.id)}
                            >
                              {ro.remove}
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? ro.editTitle : ro.createTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{ro.fieldName}</label>
                <input {...form.register('name', { required: true })} className={fieldClass()} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{ro.fieldCategory}</label>
                <select {...form.register('category')} className={fieldClass()}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {ro[`category_${c}`] ?? c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{ro.fieldAmount}</label>
                <input
                  type="number"
                  step="0.01"
                  {...form.register('amount', { required: true, valueAsNumber: true })}
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{ro.fieldFrequency}</label>
                <select {...form.register('frequency')} className={fieldClass()}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {ro[`frequency_${f}`] ?? f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{ro.fieldNextDue}</label>
                <input type="date" {...form.register('nextDueDate', { required: true })} className={fieldClass()} />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-muted-foreground">{ro.fieldNotes}</label>
                <input {...form.register('notes')} className={fieldClass()} />
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {editingId ? ro.save : ro.create}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      form.reset(EMPTY_FORM);
                    }}
                  >
                    {ro.cancel}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
