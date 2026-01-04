import { msg, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import {
  Button,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';

import styles from '../css/analytics.module.css';
import { refresh, toggleChangeSemesterDialog } from '../redux/actions';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { formatDateTime, formatSemester } from '../utils/format';

interface BarItem {
  label: string;
  value: number;
  hint?: string;
}

interface LineItem {
  label: string;
  value: number;
}

interface HeatCell {
  label: string;
  value: number;
}

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let size = bytes;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size < 10 && idx > 0 ? 2 : 1)} ${units[idx]}`;
};

const parseSizeToBytes = (value?: string | number): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const raw = value.trim().replace(/,/g, '');
  if (!raw) return undefined;
  const digitsOnly = raw.match(/^\d+$/);
  if (digitsOnly) return Number.parseInt(raw, 10);
  const match = raw.match(/([\d.]+)\s*([kmgt]?b|[kmgt])\b/i);
  if (!match) {
    const bytesMatch = raw.match(/^([\d.]+)\s*bytes?$/i);
    if (!bytesMatch) return undefined;
    const bytesValue = Number.parseFloat(bytesMatch[1]);
    return Number.isFinite(bytesValue) ? bytesValue : undefined;
  }
  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return undefined;
  const unit = match[2].toLowerCase();
  const factorMap: Record<string, number> = {
    b: 1,
    k: 1024,
    kb: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4,
  };
  return num * (factorMap[unit] ?? 1);
};

const BarChart = ({
  title,
  items,
  valueFormatter,
  className,
}: {
  title: string;
  items: BarItem[];
  valueFormatter?: (value: number) => string;
  className?: string;
}) => {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <Paper className={className ? `${styles.card} ${className}` : styles.card}>
      <Typography variant="h6" className={styles.card_title}>
        {title}
      </Typography>
      <div className={styles.chart}>
        {items.map((item) => (
          <div key={item.label} className={styles.bar_row}>
            <span className={styles.bar_label}>{item.label}</span>
            <div className={styles.bar_track}>
              <div
                className={styles.bar_fill}
                style={{ width: `${(item.value / max) * 100}%` }}
                title={item.hint}
              />
            </div>
            <span className={styles.bar_value}>
              {valueFormatter ? valueFormatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </Paper>
  );
};

const LineChart = ({ title, items }: { title: string; items: LineItem[] }) => {
  const width = 320;
  const height = 140;
  const padding = 16;
  const max = Math.max(1, ...items.map((i) => i.value));
  const step =
    items.length > 1 ? (width - padding * 2) / (items.length - 1) : width - padding * 2;
  const points = items.map((item, idx) => {
    const x = padding + idx * step;
    const y = height - padding - (item.value / max) * (height - padding * 2);
    return { x, y };
  });
  const path =
    points.length === 0
      ? ''
      : `M ${points
          .map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(' L ')}`;

  return (
    <Paper className={styles.card}>
      <Typography variant="h6" className={styles.card_title}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          <Trans>暂无数据</Trans>
        </Typography>
      ) : (
        <div className={styles.line_chart}>
          <svg className={styles.line_svg} viewBox={`0 0 ${width} ${height}`} role="img">
            <path className={styles.line_path} d={path} />
            {points.map((p) => (
              <circle key={`${p.x}-${p.y}`} className={styles.line_dot} cx={p.x} cy={p.y} r={2} />
            ))}
          </svg>
          <div className={styles.line_axis}>
            <span>{items[0]?.label}</span>
            <span>{items[items.length - 1]?.label}</span>
          </div>
        </div>
      )}
    </Paper>
  );
};

const WeeklyHourHeatmap = ({
  title,
  rows,
  max,
  rowLabels,
}: {
  title: string;
  rows: HeatCell[][];
  max: number;
  rowLabels: string[];
}) => (
  <Paper className={styles.card}>
    <Typography variant="h6" className={styles.card_title}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" className={styles.chart_note}>
      {t`横轴为小时，纵轴为星期`}
    </Typography>
    {rows.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        <Trans>暂无数据</Trans>
      </Typography>
    ) : (
      <div className={styles.heatmap_wrapper}>
        <div className={styles.heatmap_hour_labels}>
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className={styles.heatmap_hour}>
              {hour % 6 === 0 ? hour : ''}
            </span>
          ))}
        </div>
        <div className={styles.heatmap_rows}>
          {rows.map((row, rowIndex) => (
            <div key={rowLabels[rowIndex]} className={styles.heatmap_row}>
              <span className={styles.heatmap_label}>{rowLabels[rowIndex]}</span>
              <div className={styles.heatmap_grid}>
                {row.map((cell) => (
                  <span
                    key={cell.label}
                    className={styles.heatmap_cell}
                    title={`${cell.label}: ${cell.value}`}
                    style={{ backgroundColor: heatColor(cell.value, max) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </Paper>
);

const CalendarHeatmap = ({
  title,
  weeks,
  max,
  weekLabels,
  weekdayLabels,
}: {
  title: string;
  weeks: HeatCell[][];
  max: number;
  weekLabels: string[];
  weekdayLabels: string[];
}) => (
  <Paper className={styles.card}>
    <Typography variant="h6" className={styles.card_title}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" className={styles.chart_note}>
      {t`最近16周，颜色越深表示提交次数越多`}
    </Typography>
    {weeks.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        <Trans>暂无数据</Trans>
      </Typography>
    ) : (
      <div className={styles.calendar_wrapper}>
        <div className={styles.calendar_header}>
          <span className={styles.calendar_corner} />
          <div className={styles.calendar_months}>
            {weekLabels.map((label, idx) => (
              <span key={idx} className={styles.calendar_month_label}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.calendar_body}>
          <div className={styles.calendar_weekdays}>
            {weekdayLabels.map((label) => (
              <span key={label} className={styles.calendar_weekday}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.calendar_grid}>
            {weeks.map((week, idx) => (
              <div key={idx} className={styles.calendar_col}>
                {week.map((cell) => (
                  <span
                    key={cell.label}
                    className={styles.calendar_cell}
                    title={`${cell.label}: ${cell.value}`}
                    style={{ backgroundColor: heatColor(cell.value, max) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.calendar_legend}>
          <span>0</span>
          <div className={styles.calendar_scale}>
            {Array.from({ length: 5 }, (_, idx) => (
              <span
                key={idx}
                className={styles.calendar_scale_cell}
                style={{ backgroundColor: heatColor((max / 4) * idx, max) }}
              />
            ))}
          </div>
          <span>{max}</span>
        </div>
      </div>
    )}
  </Paper>
);

const pad2 = (num: number): string => num.toString().padStart(2, '0');

const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date: Date, offset: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
};

const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  const diff = next.getDay();
  next.setDate(next.getDate() - diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const heatColor = (value: number, max: number): string => {
  if (value <= 0 || max <= 0) return 'transparent';
  const alpha = 0.15 + (value / max) * 0.75;
  return `rgba(30, 136, 229, ${alpha.toFixed(3)})`;
};

const Analytics = () => {
  const dispatch = useAppDispatch();
  const { _ } = useLingui();

  const loggedIn = useAppSelector((state) => state.helper.loggedIn);
  const semester = useAppSelector((state) => state.data.semester);
  const lastUpdateTime = useAppSelector((state) => state.data.lastUpdateTime);
  const homeworkMap = useAppSelector((state) => state.data.homeworkMap);

  const weekdayLabels = [
    t`周日`,
    t`周一`,
    t`周二`,
    t`周三`,
    t`周四`,
    t`周五`,
    t`周六`,
  ];

  const homeworks = useMemo(() => Object.values(homeworkMap), [homeworkMap]);

  const submittedAll = useMemo(() => homeworks.filter((h) => h.submitted), [homeworks]);

  const submittedHomeworks = useMemo(
    () => submittedAll.filter((h) => h.submitTime),
    [submittedAll],
  );

  const submittedCount = submittedAll.length;
  const totalCount = homeworks.length;
  const submissionRate = totalCount === 0 ? 0 : submittedCount / totalCount;

  const hourBuckets = useMemo(() => {
    const counts = Array.from({ length: 24 }, () => 0);
    for (const hw of submittedHomeworks) {
      counts[hw.submitTime.getHours()] += 1;
    }
    return counts.map((value, idx) => ({
      label: `${idx}`,
      value,
    }));
  }, [submittedHomeworks]);

    const weekdayBuckets = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => 0);

    for (const hw of submittedHomeworks) {
      counts[hw.submitTime.getDay()] += 1;
    }
    return counts.map((value, idx) => ({
      label: weekdayLabels[idx],
      value,
    }));
  }, [submittedHomeworks]);

  const submissionLagBuckets = useMemo(() => {
    const buckets = [
      { label: t`逾期`, min: -Infinity, max: 0 },
      { label: t`0-6小时`, min: 0, max: 6 },
      { label: t`6-24小时`, min: 6, max: 24 },
      { label: t`1-3天`, min: 24, max: 72 },
      { label: t`3天以上`, min: 72, max: Infinity },
    ];
    const counts = Array.from({ length: buckets.length }, () => 0);
    for (const hw of submittedHomeworks) {
      if (!hw.deadline) continue;
      const diffHours = (hw.deadline.getTime() - hw.submitTime.getTime()) / 3600000;
      const idx = buckets.findIndex((b) => diffHours > b.min && diffHours <= b.max);
      if (idx >= 0) counts[idx] += 1;
    }
    return buckets.map((bucket, idx) => ({
      label: bucket.label,
      value: counts[idx],
    }));
  }, [submittedHomeworks]);

  const attachmentStats = useMemo(() => {
    const attachments = submittedAll
      .map((hw) => hw.submittedAttachment)
      .filter(Boolean);
    const sizes = attachments
      .map((file) => parseSizeToBytes(file?.size))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const buckets = [
      { label: '<100KB', min: 0, max: 100 * 1024 },
      { label: '100KB-1MB', min: 100 * 1024, max: 1024 * 1024 },
      { label: '1-5MB', min: 1024 * 1024, max: 5 * 1024 * 1024 },
      { label: '5-20MB', min: 5 * 1024 * 1024, max: 20 * 1024 * 1024 },
      { label: '>20MB', min: 20 * 1024 * 1024, max: Infinity },
    ];
    const bucketCounts = Array.from({ length: buckets.length }, () => 0);
    for (const size of sizes) {
      const idx = buckets.findIndex((b) => size > b.min && size <= b.max);
      if (idx >= 0) bucketCounts[idx] += 1;
    }

    return {
      total: attachments.length,
      totalSize: sizes.reduce((sum, s) => sum + s, 0),
      bucketItems: buckets.map((b, idx) => ({
        label: b.label,
        value: bucketCounts[idx],
      })),
    };
  }, [submittedHomeworks]);

  const courseStats = useMemo(() => {
    const map = new Map<string, { total: number; submitted: number }>();
    for (const hw of homeworks) {
      const entry = map.get(hw.courseId) ?? { total: 0, submitted: 0 };
      entry.total += 1;
      if (hw.submitted) entry.submitted += 1;
      map.set(hw.courseId, entry);
    }
    return Array.from(map.entries())
      .map(([courseId, value]) => ({
        courseId,
        ...value,
      }))
      .sort((a, b) => b.submitted - a.submitted);
  }, [homeworks]);

  const leadHours = useMemo(() => {
    if (submittedHomeworks.length === 0) return [];
    return submittedHomeworks
      .filter((hw) => hw.deadline)
      .map((hw) => (hw.deadline.getTime() - hw.submitTime.getTime()) / 3600000);
  }, [submittedHomeworks]);

  const timeStats = useMemo(() => {
    if (leadHours.length === 0) return undefined;
    const sorted = [...leadHours].sort((a, b) => a - b);
    const avg = leadHours.reduce((sum, v) => sum + v, 0) / leadHours.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    return { avg, median };
  }, [leadHours]);

  const last6Rate = useMemo(() => {
    if (leadHours.length === 0) return 0;
    const count = leadHours.filter((h) => h >= 0 && h <= 6).length;
    return count / leadHours.length;
  }, [leadHours]);

  const last24Rate = useMemo(() => {
    if (leadHours.length === 0) return 0;
    const count = leadHours.filter((h) => h >= 0 && h <= 24).length;
    return count / leadHours.length;
  }, [leadHours]);

  const nightRate = useMemo(() => {
    if (submittedHomeworks.length === 0) return 0;
    const nightCount = submittedHomeworks.filter((hw) => {
      const hour = hw.submitTime.getHours();
      return hour >= 22 || hour < 6;
    }).length;
    return nightCount / submittedHomeworks.length;
  }, [submittedHomeworks, weekdayLabels]);

  const weekendRate = useMemo(() => {
    if (submittedHomeworks.length === 0) return 0;
    const weekendCount = submittedHomeworks.filter((hw) => {
      const day = hw.submitTime.getDay();
      return day === 0 || day === 6;
    }).length;
    return weekendCount / submittedHomeworks.length;
  }, [submittedHomeworks, weekdayLabels]);

  const lateRate = useMemo(() => {
    if (submittedHomeworks.length === 0) return 0;
    const lateCount = submittedHomeworks.filter(
      (hw) => hw.deadline && hw.submitTime.getTime() > hw.deadline.getTime(),
    ).length;
    return lateCount / submittedHomeworks.length;
  }, [submittedHomeworks, weekdayLabels]);

  const activityStats = useMemo(() => {
    const days = Array.from(
      new Set(submittedHomeworks.map((hw) => formatDateKey(hw.submitTime))),
    ).sort();
    if (days.length === 0) return { activeDays: 0, longestStreak: 0 };
    let longest = 1;
    let current = 1;
    for (let i = 1; i < days.length; i += 1) {
      const prev = new Date(days[i - 1]);
      const next = new Date(days[i]);
      const diff = (next.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        current += 1;
      } else {
        longest = Math.max(longest, current);
        current = 1;
      }
    }
    longest = Math.max(longest, current);
    return { activeDays: days.length, longestStreak: longest };
  }, [submittedHomeworks, weekdayLabels]);

  const submissionTrend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hw of submittedHomeworks) {
      const key = formatDateKey(hw.submitTime);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const candidateDates = [
      ...submittedHomeworks.map((hw) => hw.submitTime),
      ...homeworks.map((hw) => hw.deadline).filter(Boolean),
    ].filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));

    if (candidateDates.length === 0) return [];

    const minDate = candidateDates.reduce((min, date) => (date < min ? date : min));
    const maxDate = candidateDates.reduce((max, date) => (date > max ? date : max));

    const firstDate = semester.startDate instanceof Date ? semester.startDate : undefined;
    const lastDate = semester.endDate instanceof Date ? semester.endDate : undefined;
    let start = minDate;
    let end = maxDate;

    if (firstDate && lastDate) {
      const startCandidate = new Date(firstDate);
      const endCandidate = new Date(lastDate);
      if (endCandidate < startCandidate) {
        const tmp = startCandidate;
        startCandidate.setTime(endCandidate.getTime());
        endCandidate.setTime(tmp.getTime());
      }
      const rangeDays = (endCandidate.getTime() - startCandidate.getTime()) / 86400000;
      if (Number.isFinite(rangeDays) && rangeDays >= 7) {
        start = startCandidate;
        end = endCandidate;
      }
    }

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const items: LineItem[] = [];
    for (let i = 0; i < totalDays; i += 1) {
      const date = addDays(start, i);
      const key = formatDateKey(date);
      const [_, month, day] = key.split('-');
      items.push({ label: `${month}/${day}`, value: counts.get(key) ?? 0 });
    }
    return items;
  }, [submittedHomeworks, homeworks, semester.startDate, semester.endDate]);

  const pendingRisk = useMemo(() => {
    const now = Date.now();
    const pending = homeworks.filter((hw) => !hw.submitted && hw.deadline);
    const buckets = [
      { label: t`<6小时`, min: 0, max: 6 },
      { label: t`6-24小时`, min: 6, max: 24 },
      { label: t`1-3天`, min: 24, max: 72 },
      { label: t`3天以上`, min: 72, max: Infinity },
    ];
    const counts = Array.from({ length: buckets.length }, () => 0);
    for (const hw of pending) {
      const diffHours = (hw.deadline.getTime() - now) / 3600000;
      if (diffHours < 0) continue;
      const idx = buckets.findIndex((b) => diffHours > b.min && diffHours <= b.max);
      if (idx >= 0) counts[idx] += 1;
    }
    const soonCount = counts[0] + counts[1];
    const total = counts.reduce((sum, v) => sum + v, 0);
    const riskScore = total === 0 ? 0 : soonCount / total;
    return {
      total,
      riskScore,
      items: buckets.map((b, idx) => ({ label: b.label, value: counts[idx] })),
    };
  }, [homeworks]);

  const weeklyHourHeatmap = useMemo(() => {
    if (submittedHomeworks.length == 0) return { rows: [], max: 0 };
    const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const hw of submittedHomeworks) {
      const day = hw.submitTime.getDay();
      const hour = hw.submitTime.getHours();
      counts[day][hour] += 1;
    }
    let max = 0;
    const rows = counts.map((row, day) =>
      row.map((value, hour) => {
        if (value > max) max = value;
        return {
          label: `${weekdayLabels[day]} ${pad2(hour)}:00`,
          value,
        };
      }),
    );
    return { rows, max };
  }, [submittedHomeworks, weekdayLabels]);

  const calendarHeatmap = useMemo(() => {
    if (submittedHomeworks.length == 0) return { weeks: [], max: 0, weekLabels: [] };
    const counts = new Map();
    for (const hw of submittedHomeworks) {
      const key = formatDateKey(hw.submitTime);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const maxDate = new Date(Math.max(...submittedHomeworks.map((h) => h.submitTime.getTime())));
    const weeksCount = 16;
    const startDate = startOfWeek(addDays(maxDate, -(weeksCount * 7 - 1)));
    const weeks = [];
    const weekLabels: string[] = [];
    let max = 0;
    let lastMonth = -1;
    for (let w = 0; w < weeksCount; w += 1) {
      const week = [];
      const weekStart = addDays(startDate, w * 7);
      const month = weekStart.getMonth();
      if (month !== lastMonth) {
        weekLabels.push(`${month + 1}月`);
        lastMonth = month;
      } else {
        weekLabels.push('');
      }
      for (let d = 0; d < 7; d += 1) {
        const date = addDays(startDate, w * 7 + d);
        const key = formatDateKey(date);
        const value = counts.get(key) ?? 0;
        if (value > max) max = value;
        week.push({ label: key, value });
      }
      weeks.push(week);
    }
    return { weeks, max, weekLabels };
  }, [submittedHomeworks]);

  const procrastinationProfile = useMemo(() => {
    const rawScore = lateRate * 0.5 + last24Rate * 0.3 + last6Rate * 0.2;
    const score = Math.round(Math.min(1, rawScore) * 100);
    let label = t`超前型`;
    let desc = t`提前规划，很少拖延`;
    if (score > 80) {
      label = t`极限型`;
      desc = t`常在最后时刻提交`;
    } else if (score > 60) {
      label = t`冲刺型`;
      desc = t`多在截止前提交`;
    } else if (score > 40) {
      label = t`临界型`;
      desc = t`停停催催，偶尔压线`;
    } else if (score > 20) {
      label = t`稳健型`;
      desc = t`节奏稳定，成品率高`;
    }
    return { score, label, desc };
  }, [lateRate, last24Rate, last6Rate]);


  const recentSubmissions = useMemo(
    () =>
      [...submittedHomeworks]
        .sort((a, b) => b.submitTime.getTime() - a.submitTime.getTime())
        .slice(0, 20),
    [submittedHomeworks],
  );

  if (!loggedIn) {
    return (
      <section className={styles.wrapper}>
        <Paper className={styles.card}>
          <Typography variant="h6">
            <Trans>请先登录后查看统计</Trans>
          </Typography>
        </Paper>
      </section>
    );
  }

  return (
    <section className={styles.wrapper}>
      <Paper className={styles.card}>
        <div className={styles.card_header}>
          <div>
            <Typography variant="h5">
              <Trans>作业提交统计</Trans>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <Trans>当前学期：</Trans>
              {formatSemester(semester)}
              {' · '}
              <Trans>最后更新时间：</Trans>
              {formatDateTime(lastUpdateTime)}
            </Typography>
          </div>
          <div className={styles.card_actions}>
            <Button
              variant="outlined"
              onClick={() => dispatch(toggleChangeSemesterDialog(true))}
            >
              <Trans>切换学期</Trans>
            </Button>
            <Button variant="contained" onClick={() => dispatch(refresh())}>
              <Trans>刷新数据</Trans>
            </Button>
          </div>
        </div>
        <Divider className={styles.section_divider} />
        <div className={styles.kpi_grid}>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{totalCount}</Typography>
            <Typography className={styles.kpi_label}>
              <Trans>作业总数</Trans>
            </Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{submittedCount}</Typography>
            <Typography className={styles.kpi_label}>
              <Trans>已提交</Trans>
            </Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{formatPercent(submissionRate)}</Typography>
            <Typography className={styles.kpi_label}>
              <Trans>提交率</Trans>
            </Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{formatPercent(nightRate)}</Typography>
            <Typography className={styles.kpi_label}>{t`夜间提交占比`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{formatPercent(weekendRate)}</Typography>
            <Typography className={styles.kpi_label}>{t`周末提交占比`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{formatPercent(lateRate)}</Typography>
            <Typography className={styles.kpi_label}>{t`逾期提交占比`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{pendingRisk.total}</Typography>
            <Typography className={styles.kpi_label}>{t`未提交作业`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{formatPercent(pendingRisk.riskScore)}</Typography>
            <Typography className={styles.kpi_label}>{t`临近截止占比`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{attachmentStats.total}</Typography>
            <Typography className={styles.kpi_label}>
              <Trans>含附件作业</Trans>
            </Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>
              {formatBytes(attachmentStats.totalSize)}
            </Typography>
            <Typography className={styles.kpi_label}>
              <Trans>附件总大小</Trans>
            </Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{activityStats.activeDays}</Typography>
            <Typography className={styles.kpi_label}>{t`活跃提交天数`}</Typography>
          </div>
          <div className={styles.kpi_item}>
            <Typography className={styles.kpi_value}>{activityStats.longestStreak}</Typography>
            <Typography className={styles.kpi_label}>{t`最长连续提交`}</Typography>
          </div>
          {timeStats && (
            <div className={styles.kpi_item}>
              <Typography className={styles.kpi_value}>{timeStats.avg.toFixed(1)}h</Typography>
              <Typography className={styles.kpi_label}>
                <Trans>平均提前提交</Trans>
              </Typography>
            </div>
          )}
        </div>
      </Paper>

            <div className={styles.grid}>
        <CalendarHeatmap
          title={t`提交日历热力图`}
          weeks={calendarHeatmap.weeks}
          max={calendarHeatmap.max}
          weekLabels={calendarHeatmap.weekLabels}
          weekdayLabels={weekdayLabels}
        />
        <WeeklyHourHeatmap
          title={t`提交时间热力图（周-小时）`}
          rows={weeklyHourHeatmap.rows}
          max={weeklyHourHeatmap.max}
          rowLabels={weekdayLabels}
        />
        <LineChart title={t`提交时间线（本学期）`} items={submissionTrend} />
        <BarChart title={t`提交星期分布`} items={weekdayBuckets} />
        <BarChart title={t`截止前提交分布`} items={submissionLagBuckets} />
        <BarChart title={t`未提交作业风险分布`} items={pendingRisk.items} />
      </div>

      <div className={styles.wide_section}>
        <BarChart
          title={t`提交时段分布（小时）`}
          items={hourBuckets}
          className={styles.wide_chart}
        />
        <BarChart
          title={t`附件大小分布`}
          items={attachmentStats.bucketItems}
          valueFormatter={(value) => value.toString()}
          className={styles.wide_chart}
        />
      </div>




<Paper className={styles.card}>
        <Typography variant="h6" className={styles.card_title}>
          {t`个人拖延画像`}
        </Typography>
        <div className={styles.profile_grid}>
          <div className={styles.profile_main}>
            <Typography className={styles.profile_score}>{procrastinationProfile.score}</Typography>
            <Typography className={styles.profile_label}>{procrastinationProfile.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {procrastinationProfile.desc}
            </Typography>
          </div>
          <div className={styles.profile_stats}>
            <div className={styles.profile_item}>
              <span className={styles.profile_item_label}>
                {t`截止前6小时`}
              </span>
              <span className={styles.profile_item_value}>{formatPercent(last6Rate)}</span>
            </div>
            <div className={styles.profile_item}>
              <span className={styles.profile_item_label}>
                {t`截止前24小时`}
              </span>
              <span className={styles.profile_item_value}>{formatPercent(last24Rate)}</span>
            </div>
            <div className={styles.profile_item}>
              <span className={styles.profile_item_label}>{t`夜间提交`}</span>
              <span className={styles.profile_item_value}>{formatPercent(nightRate)}</span>
            </div>
            <div className={styles.profile_item}>
              <span className={styles.profile_item_label}>{t`周末提交`}</span>
              <span className={styles.profile_item_value}>{formatPercent(weekendRate)}</span>
            </div>
            <div className={styles.profile_item}>
              <span className={styles.profile_item_label}>{t`逾期提交`}</span>
              <span className={styles.profile_item_value}>{formatPercent(lateRate)}</span>
            </div>
          </div>
        </div>
      </Paper>

      <Paper className={styles.card}>
        <Typography variant="h6" className={styles.card_title}>
          <Trans>最近提交</Trans>
        </Typography>
        {recentSubmissions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            <Trans>暂无提交记录</Trans>
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{_(msg`课程`)}</TableCell>
                <TableCell>{_(msg`作业标题`)}</TableCell>
                <TableCell align="right">{_(msg`提交时间`)}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentSubmissions.map((hw) => (
                <TableRow key={hw.id}>
                  <TableCell>{_({ id: `course-${hw.courseId}` })}</TableCell>
                  <TableCell>{hw.title}</TableCell>
                  <TableCell align="right">{formatDateTime(hw.submitTime)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </section>
  );
};

export default Analytics;
