import { formatDeadline } from './formatDate';
import { REMINDER_OFFSET_OPTIONS } from '../../data/reminderOffsets';

export type DeferTarget = 'plus3Hours' | 'plus7Hours' | 'tonight' | 'tomorrow' | 'nextWorkday' | 'nextMonday';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 将任务延后到一个可预期的本地时刻；所有日期计算均用本地日历，避免 UTC 跨日。 */
export function deferredDeadline(
  target: DeferTarget,
  defaultHourOrNow: number | Date = new Date(),
  defaultMinute?: number,
  compatibilityNow?: Date,
): number {
  // 兼容旧调用签名 (target, hour, minute, now)；新调用只传 target，使用当前时分。
  const legacy = typeof defaultHourOrNow === 'number';
  const now = compatibilityNow ?? (defaultHourOrNow instanceof Date ? defaultHourOrNow : new Date());
  const hour = legacy ? defaultHourOrNow : now.getHours();
  const minute = legacy ? (defaultMinute ?? 0) : now.getMinutes();
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (target === 'plus3Hours' || target === 'plus7Hours') {
    next.setHours(next.getHours() + (target === 'plus3Hours' ? 3 : 7), next.getMinutes(), 0, 0);
    return next.getTime();
  }

  if (target === 'tonight') {
    next.setHours(hour, minute, 0, 0);
    return next.getTime();
  }

  if (target === 'tomorrow') {
    next.setDate(next.getDate() + 1);
  } else if (target === 'nextWorkday') {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
  } else {
    const daysUntilMonday = ((8 - next.getDay()) % 7) || 7;
    next.setDate(next.getDate() + daysUntilMonday);
  }
  next.setHours(hour, minute, 0, 0);
  return next.getTime();
}

export function deferTargetLabel(target: DeferTarget): string {
  return ({ plus3Hours: '延后三小时', plus7Hours: '延后七小时', tonight: '今晚', tomorrow: '明天', nextWorkday: '下个工作日', nextMonday: '下周一' })[target];
}

/** 绝对提醒跟随任务平移；相对提醒不存绝对值，会由 TaskService 根据新截止自动派生。 */
export function shiftReminderTimes(reminderTimes: number[], previousDeadline: number | null, nextDeadline: number): number[] {
  if (previousDeadline === null) return reminderTimes;
  const delta = nextDeadline - previousDeadline;
  return reminderTimes.map((time) => time + delta);
}

export function timingConfirmation(
  deadline: number | null,
  reminderOffsets: string[] = [],
  reminderTimes: number[] = [],
): string {
  const pieces = [deadline === null ? '未设置截止时间' : `已设为：${formatDeadline(deadline)}`];
  const offsetLabels = reminderOffsets
    .map((key) => REMINDER_OFFSET_OPTIONS.find((option) => option.key === key)?.label)
    .filter((label): label is string => Boolean(label));
  if (offsetLabels.length) pieces.push(`${offsetLabels.join('、')}提醒`);
  if (reminderTimes.length) pieces.push(`提醒：${reminderTimes.map(formatDeadline).join('、')}`);
  return pieces.join('，');
}

export const DAY = DAY_MS;
