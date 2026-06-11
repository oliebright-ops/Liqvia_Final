import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export interface FinancialColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  mono?: boolean;
  muted?: boolean;
  render: (row: T) => ReactNode;
}

export function FinancialTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: FinancialColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'pb-2 pr-4 font-medium',
                  col.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border/60 transition-colors hover:bg-muted/20"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'py-2.5 pr-4',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.mono && 'font-mono tabular-nums',
                    col.muted ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
