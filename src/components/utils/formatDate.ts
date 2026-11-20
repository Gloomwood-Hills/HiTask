/**
 * 日期格式化工具：与设计稿日期徽章格式保持一致
 */

const day = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 是否包含具体时间：00:00:00（开始仅日期）与 23:59:00（截止仅日期）视为"仅日期"；带秒的边界时刻（如"一小时后"恰为 23:59:01）视为具体时刻 */
export function hasExplicitTime(ts: number): boolean {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  return !(s === 0 && ((h === 0 && m === 0) || (h === 23 && m === 59)));
}

/** 截止时间仅填日期时，补为本次操作时刻；已含具体时刻则原样返回。保留可选时分参数兼容旧数据/调用。 */
export function applyDefaultDeadlineTime(ts: number | null, hour?: number, minute?: number): number | null {
  if (ts == null) return null;
  if (hasExplicitTime(ts)) return ts;
  const d = new Date(ts);
  const now = new Date();
  d.setHours(hour ?? now.getHours(), minute ?? now.getMinutes(), 0, 0);
  return d.getTime();
}

/** 相对标签：明天/后天/本周x/下周x（x=一/二/三/四/五/六/日）；超出范围返回空串（仅年月日） */
export function formatDeadlineRel(deadline: number): string {
  const now = new Date();
  const diffDays = Math.round((startOfDay(deadline) - startOfDay(now.getTime())) / day);
  if (diffDays === 1) return '明天';
  if (diffDays === 2) return '后天';

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const mondayOf = (d: Date): number => {
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); // 距周一
    const m = new Date(d);
    m.setDate(m.getDate() + diff);
    return startOfDay(m.getTime());
  };
  const weekDiff = Math.round((mondayOf(new Date(deadline)) - mondayOf(now)) / (7 * day));
  if (weekDiff === 0) return `本周${weekdays[new Date(deadline).getDay()]}`;
  if (weekDiff === 1) return `下周${weekdays[new Date(deadline).getDay()]}`;
  return '';
}

/** 年月日标签：2026.8.9；含具体时间时附 HH:mm */
export function formatDeadlineYMD(deadline: number): string {
  const d = new Date(deadline);
  const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  return hasExplicitTime(deadline) ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** 截止时间组合文案：相对标签 + 年月日（如 "明天 2026.8.9" / "2026.8.15"） */
export function formatDeadline(deadline: number): string {
  const rel = formatDeadlineRel(deadline);
  const ymd = formatDeadlineYMD(deadline);
  return rel ? `${rel} ${ymd}` : ymd;
}

/** 格式化开始日期徽章：仅日期时 MM-DD；含具体时间时 MM-DD HH:mm */
export function formatStartDate(startDate: number): string {
  const d = new Date(startDate);
  const date = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return hasExplicitTime(startDate) ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** 格式化完成时间：7月19日 */
export function formatCompletedAt(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 截止时间徽章颜色分级：逾期=红、1天内=红、3天内=橙、7天内=默认 */
// ===== 自然语言日期解析（Quick Capture） =====

const WEEK_CN: Record<string, number> = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6, '天': 6 };
const NUM_CN: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6,
  '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14,
  '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26,
  '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30, '三十一': 31,
};

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** 阿拉伯或中文数字 → number */
function toNumber(token: string): number | null {
  if (/^\d{1,2}$/.test(token)) return parseInt(token, 10);
  return NUM_CN[token] ?? null;
}

/** 构造并校验日历日期，避免 Date 自动把 9 月 31 日滚到 10 月 1 日。 */
function createValidDate(year: number, month: number, date: number): Date | null {
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const result = new Date(year, month - 1, date);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== date) return null;
  return result;
}

/** 未写年份的月日，按“下一次出现”解释；当前日期尚未到时使用今年，已过则使用明年。 */
function createUpcomingMonthDay(now: Date, month: number, date: number): Date | null {
  let result = createValidDate(now.getFullYear(), month, date);
  if (!result) return null;
  if (startOfDay(result.getTime()) < startOfDay(now.getTime())) {
    result = createValidDate(now.getFullYear() + 1, month, date);
  }
  return result;
}

/**
 * 解析自然语言中的日期/时间，返回截止时间戳（解析不到返回 null）。
 * 支持：今天/明天/后天/月底/周X/下周一 + 上午/下午/傍晚/晚上/半夜/早上 + X点(Y分)（中文或数字）
 * 例："明天下午三点" → 明天 15:00；"周五" → 本周五 23:59；"下午三点" → 今天 15:00
 */
export function parseNaturalDateTime(text: string): number | null {
  const now = new Date();

  // 相对时间：X小时后 / X小时（如"一小时后"、"1小时后"），精确到具体时刻
  const afterHours = text.match(/(\d{1,2}|[一二两三四五六七八九十]{1,2})\s*(?:个)?小时(?:以)?后/);
  if (afterHours) {
    const n = toNumber(afterHours[1]);
    if (n !== null && n > 0) {
      const t = new Date(now.getTime() + n * 3600 * 1000);
      // 若恰好落在"仅日期"标记（00:00:00 / 23:59:00），+1秒以保留具体时刻语义
      if (t.getSeconds() === 0 && ((t.getHours() === 23 && t.getMinutes() === 59) || (t.getHours() === 0 && t.getMinutes() === 0))) {
        t.setSeconds(1);
      }
      return t.getTime();
    }
  }

  let base: Date | null = null;

  // ===== 具体日期格式（优先级最高）=====
  // x年x月x日/号（如 2026年8月9日，年份为阿拉伯数字，月日支持中文数字）
  const ymdCN = text.match(/(\d{4})年\s*([0-9一二两三四五六七八九十]{1,3})\s*月\s*([0-9一二两三四五六七八九十]{1,3})\s*(?:日|号)/);
  // YYYY.M.D 或 YY.M.D（如 2026.8.9 / 26.8.9）
  const ymdDot = text.match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/);
  // x月x日/x号（如 8月9日 / 八月二十九号）
  const mdCN = text.match(/([0-9一二两三四五六七八九十]{1,3})\s*月\s*([0-9一二两三四五六七八九十]{1,3})\s*(?:日|号)/);
  // M.D（如 8.9；排除被更长数字/点串包含的情况）
  const mdDot = text.match(/(?:^|[^\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/);

  if (ymdCN) {
    base = createValidDate(parseInt(ymdCN[1], 10), toNumber(ymdCN[2]) ?? 0, toNumber(ymdCN[3]) ?? 0);
    if (!base) return null;
  } else if (ymdDot) {
    const y = ymdDot[1].length === 2 ? 2000 + parseInt(ymdDot[1], 10) : parseInt(ymdDot[1], 10);
    base = createValidDate(y, toNumber(ymdDot[2]) ?? 0, toNumber(ymdDot[3]) ?? 0);
    if (!base) return null;
  } else if (mdCN) {
    const m = toNumber(mdCN[1]) ?? 0;
    const d = toNumber(mdCN[2]) ?? 0;
    base = createUpcomingMonthDay(now, m, d);
    if (!base) return null;
  } else if (mdDot) {
    const m = toNumber(mdDot[1]) ?? 0;
    const d = toNumber(mdDot[2]) ?? 0;
    base = createUpcomingMonthDay(now, m, d);
    if (!base) return null;
  }

  // ===== 相对日期 =====
  if (!base && /月底/.test(text)) {
    base = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (!base && /后天/.test(text)) {
    base = addDays(now, 2);
  } else if (!base && /明天|明日/.test(text)) {
    base = addDays(now, 1);
  } else if (!base && /今天|今日|今晚/.test(text)) {
    base = now;
  } else if (!base) {
    const wm = text.match(/(?:下个?周|周|星期|礼拜)([一二三四五六日天])/);
    if (wm) {
      // 周一为一周开始：本周一 = 今天 - 距周一天数（周一→0 … 周日→6）
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
      let d = addDays(thisMonday, (wm[0].startsWith('下') ? 7 : 0) + (WEEK_CN[wm[1]] ?? 0));
      if (d.getTime() < startOfDay(now.getTime())) d = addDays(d, 7);
      base = d;
    }
  }

  // 时间部分：上午/下午/晚上 + X点(Y分)
  let hour: number | null = null;
  let minute = 0;
  const period = text.match(/上午|下午|傍晚|晚上|半夜|凌晨|中午|早上|早晨|清晨/);
  const hm = text.match(/(上午|下午|傍晚|晚上|半夜|凌晨|中午|早上|早晨|清晨)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*[点时:：]\s*(\d{1,2}|[一二两三四五六七八九十]{1,2})?\s*(?:分|半)?/);
  if (hm) {
    let h = toNumber(hm[2]);
    if (h === null) h = 0; // 中文数字未命中（如"零"）时兜底
    if ((hm[1] === '下午' || hm[1] === '晚上' || hm[1] === '傍晚' || hm[1] === '中午') && h < 12) h += 12;
    if (hm[1] === '半夜' && h === 12) h = 0;
    hour = h;
    if (hm[3]) minute = toNumber(hm[3]) ?? 0;
    else if (/半\s*$/.test(hm[0])) minute = 30;
  }

  // 时间格式命中了但数值越界时，不返回一个静默修正后的错误时间。
  if (hour !== null && (hour < 0 || hour > 23 || minute < 0 || minute > 59)) return null;

  // 只说“早上/下午”等时段时也应产生明确时刻，避免后续默认截止时间把时段覆盖。
  if (hour === null && period) {
    switch (period[0]) {
      case '上午': case '早上': case '早晨': case '清晨': hour = 9; break;
      case '中午': hour = 12; break;
      case '下午': hour = 16; break;
      case '傍晚': hour = 18; break;
      case '晚上': hour = 20; break;
      case '半夜': case '凌晨': hour = 0; break;
    }
  }

  if (!base && hour === null) return null;

  const target = base ? new Date(base) : new Date(now);
  if (hour !== null) {
    target.setHours(hour, minute, 0, 0);
    // 00:00 同时是“仅日期”的内部哨兵；半夜/凌晨是用户明确指定的时段，
    // 用 1 秒保留显式时刻语义，展示层仍按 HH:mm 显示为 00:00。
    if (hour === 0 && minute === 0 && (period?.[0] === '半夜' || period?.[0] === '凌晨')) target.setSeconds(1);
  } else {
    target.setHours(23, 59, 0, 0); // 仅指定日期 → 当日结束作为截止
  }
  return target.getTime();
}

/** 仅剔除已经成功解析的日期/时刻片段，保留任务标题里的其他数字与文字。 */
export function stripNaturalDateTime(text: string): string {
  if (parseNaturalDateTime(text) === null) return text.trim();
  return text
    .replace(/(?:\d{1,2}|[一二两三四五六七八九十]{1,2})\s*(?:个)?小时(?:以)?后/g, ' ')
    .replace(/\d{4}年\s*[0-9一二两三四五六七八九十]{1,3}\s*月\s*[0-9一二两三四五六七八九十]{1,3}\s*(?:日|号)/g, ' ')
    .replace(/\d{2,4}\.\d{1,2}\.\d{1,2}/g, ' ')
    .replace(/[0-9一二两三四五六七八九十]{1,3}\s*月\s*[0-9一二两三四五六七八九十]{1,3}\s*(?:日|号)/g, ' ')
    .replace(/(^|[^\d.])\d{1,2}\.\d{1,2}(?![\d.])/g, '$1 ')
    .replace(/(?:下个?周|周|星期|礼拜)\s*[一二三四五六日天]|大后天|后天|明天|明日|今天|今日|今晚|月底/g, ' ')
    .replace(/(?:上午|下午|傍晚|晚上|半夜|凌晨|中午|早上|早晨|清晨)?\s*(?:\d{1,2}|[一二两三四五六七八九十]{1,3})\s*[点时:：]\s*(?:\d{1,2}|[一二两三四五六七八九十]{1,2})?\s*(?:分|半)?/g, ' ')
    .replace(/上午|下午|傍晚|晚上|半夜|凌晨|中午|早上|早晨|清晨/g, ' ')
    .replace(/^[\s,，、;；+＋]*(?:截止|到期)(?:时间)?[:：]?\s*|[\s,，、;；+＋]+$/g, ' ')
    .trim();
}
