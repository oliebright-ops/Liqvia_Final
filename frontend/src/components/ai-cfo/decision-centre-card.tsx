'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useDecisionCentre } from '@/hooks/use-decision-centre';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionType } from '@/lib/module-types';
import { MarkdownReply } from './markdown-reply';

const PERCENT_TYPES: DecisionType[] = ['hire', 'expand'];
const AMOUNT_TYPES: DecisionType[] = ['buy_equipment', 'withdraw_funds', 'repay_debt'];
const PRESET_DEFAULTS: Record<string, number> = {
  hire: 10,
  expand: 15,
  buy_equipment: 10000,
  withdraw_funds: 5000,
  repay_debt: 10000,
};

const PRESET_TYPES: DecisionType[] = ['hire', 'buy_equipment', 'withdraw_funds', 'repay_debt', 'expand'];

export function DecisionCentreCard() {
  const { t, locale } = useLanguage();
  const dc = (t.modules as Record<string, Record<string, unknown>>).decisionCentre as Record<
    string,
    string
  >;
  const { mutate, data, isPending, error } = useDecisionCentre();

  const [active, setActive] = useState<DecisionType | null>(null);
  const [value, setValue] = useState<number>(0);
  const [customQuestion, setCustomQuestion] = useState('');

  function openPreset(type: DecisionType) {
    setActive(type);
    setValue(PRESET_DEFAULTS[type] ?? 0);
  }

  function submitPreset() {
    if (!active) return;
    const isPercent = PERCENT_TYPES.includes(active);
    mutate({
      type: active,
      percent: isPercent ? value : undefined,
      amount: AMOUNT_TYPES.includes(active) ? value : undefined,
      locale,
    });
  }

  function submitCustom() {
    if (!customQuestion.trim()) return;
    mutate({ type: 'custom', customQuestion: customQuestion.trim(), locale });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm">{dc.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESET_TYPES.map((type) => (
            <Button
              key={type}
              variant={active === type ? 'primary' : 'outline'}
              className="px-3 py-1.5 text-xs"
              onClick={() => openPreset(type)}
            >
              {dc[`button_${type}`]}
            </Button>
          ))}
          <Button
            variant={active === 'custom' ? 'primary' : 'outline'}
            className="px-3 py-1.5 text-xs"
            onClick={() => setActive('custom')}
          >
            {dc.button_custom}
          </Button>
        </div>

        {active && active !== 'custom' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">
              {PERCENT_TYPES.includes(active) ? dc.fieldPercent : dc.fieldAmount}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-32 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button className="px-3 py-1.5 text-xs" onClick={submitPreset} disabled={isPending}>
              {isPending ? dc.checking : dc.check}
            </Button>
          </div>
        )}

        {active === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder={dc.customPlaceholder}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCustom();
              }}
            />
            <Button className="px-3 py-1.5 text-xs" onClick={submitCustom} disabled={isPending}>
              {isPending ? dc.checking : dc.check}
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-cash-negative">{dc.error}</p>}

        {data && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{data.question}</p>
            <MarkdownReply content={data.text} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
