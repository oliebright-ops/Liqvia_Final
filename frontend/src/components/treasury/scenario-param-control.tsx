'use client';

import type { ScenarioParamSpec } from '@liqvia2/shared';
import { clampScenarioParam } from '@liqvia2/shared';

export function ScenarioParamControl({
  spec,
  value,
  label,
  onChange,
}: {
  spec: ScenarioParamSpec;
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const sliderMax = spec.max;
  const inputMax = spec.inputMax ?? spec.max;
  const sliderValue = Math.min(value, sliderMax);

  function commit(next: number) {
    onChange(clampScenarioParam(spec.key, next));
  }

  return (
    <div className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <input
          type="number"
          min={spec.min}
          max={inputMax}
          step={spec.step}
          value={Number.isFinite(value) ? value : spec.min}
          onChange={(e) => {
            const parsed = e.target.value === '' ? spec.min : Number(e.target.value);
            commit(parsed);
          }}
          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground"
        />
      </div>
      {spec.showSlider !== false && (
        <input
          type="range"
          min={spec.min}
          max={sliderMax}
          step={spec.step}
          value={sliderValue}
          onChange={(e) => commit(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      )}
    </div>
  );
}
