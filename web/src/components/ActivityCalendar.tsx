import { useMemo } from 'react';
import { calendarWeeks, type DayMap } from '../services/stats';

/**
 * GitHub-style learning-activity heatmap: 12 weeks × 7 days, sequential
 * accent ramp (dark → light = more activity). Each cell carries a native
 * title tooltip with the date; the grid itself is described for screen
 * readers via aria-label.
 */
export function ActivityCalendar({ days }: { days: DayMap }) {
  const weeks = useMemo(() => calendarWeeks(days), [days]);

  return (
    <div className="cal">
      <div className="cal__grid" role="img" aria-label="直近12週間の学習アクティビティ">
        {weeks.map((col) => (
          <div className="cal__week" key={col[0].key}>
            {col.map((c) => (
              <div
                key={c.key}
                title={c.isFuture ? undefined : c.key}
                className={
                  c.isFuture
                    ? 'cal__cell cal__cell--future'
                    : `cal__cell cal__cell--l${c.level}${c.isToday ? ' cal__cell--today' : ''}`
                }
              />
            ))}
          </div>
        ))}
      </div>
      <div className="cal__legend" aria-hidden="true">
        <span>少</span>
        <span className="cal__cell cal__cell--l0" />
        <span className="cal__cell cal__cell--l1" />
        <span className="cal__cell cal__cell--l2" />
        <span className="cal__cell cal__cell--l3" />
        <span>多</span>
      </div>
    </div>
  );
}
