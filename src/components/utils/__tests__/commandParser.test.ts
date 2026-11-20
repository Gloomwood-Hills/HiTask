import { describe, expect, it } from 'vitest';
import { parseCommand } from '../commandParser';
import { parseNaturalDateTime, stripNaturalDateTime } from '../formatDate';
import { deriveReminderAt } from '../../../data/reminderOffsets';

describe('焦点视图命令', () => {
  it('识别焦点视图的常用表达', () => {
    expect(parseCommand('焦点')).toEqual({ kind: 'open-view', view: 'focus' });
    expect(parseCommand('打开今天只看这几件事')).toEqual({ kind: 'open-view', view: 'focus' });
  });
});

describe('自然语言截止时间', () => {
  it('解析九点十分吃饭，并在保存标题时剔除时刻', () => {
    const parsed = parseCommand('九点十分吃饭');
    expect(parsed).toMatchObject({ kind: 'create-task', title: '吃饭' });
    if (parsed.kind !== 'create-task') return;
    expect(new Date(parsed.deadline as number).getHours()).toBe(9);
    expect(new Date(parsed.deadline as number).getMinutes()).toBe(10);
    expect(stripNaturalDateTime('填写奖学金审批材料9月29号12点')).toBe('填写奖学金审批材料');
    expect(stripNaturalDateTime('买12个鸡蛋')).toBe('买12个鸡蛋');
  });

  it('识别带“号”的中文月日，并保留明确的十二点', () => {
    const result = parseNaturalDateTime('九月二十九号十二点');
    expect(result).not.toBeNull();
    const date = new Date(result as number);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(29);
    expect(date.getHours()).toBe(12);
    expect(date.getMinutes()).toBe(0);
  });

  it('识别任务标题末尾连写的日期和时间', () => {
    const result = parseNaturalDateTime('填写奖学金审批材料9月29号12点');
    expect(result).not.toBeNull();
    const date = new Date(result as number);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(29);
    expect(date.getHours()).toBe(12);
  });

  it('支持上午/下午、中午与半点表达', () => {
    const afternoon = new Date(parseNaturalDateTime('9月29日 下午3点半') as number);
    expect(afternoon.getHours()).toBe(15);
    expect(afternoon.getMinutes()).toBe(30);

    const noon = new Date(parseNaturalDateTime('9月29日 中午12点') as number);
    expect(noon.getHours()).toBe(12);
  });

  it('识别完整时段词，即使没有写具体小时', () => {
    const cases: Array<[string, number]> = [
      ['9月29日 上午', 9],
      ['9月29日 早上', 9],
      ['9月29日 下午', 16],
      ['9月29日 傍晚', 18],
      ['9月29日 晚上', 20],
      ['9月29日 半夜', 0],
    ];
    for (const [text, hour] of cases) {
      expect(new Date(parseNaturalDateTime(text) as number).getHours()).toBe(hour);
    }
    expect(new Date(parseNaturalDateTime('9月29日 半夜十二点') as number).getHours()).toBe(0);
  });

  it('不把非法日期静默滚动到下个月', () => {
    expect(parseNaturalDateTime('9月31日12点')).toBeNull();
  });
});

describe('默认提醒', () => {
  it('未单独设置提醒时在截止时提醒；自定义提前提醒覆盖默认时刻', () => {
    const deadline = new Date(2026, 8, 29, 9, 10).getTime();
    expect(deriveReminderAt(deadline, [])).toBe(deadline);
    expect(deriveReminderAt(deadline, ['1h'])).toBe(deadline - 60 * 60 * 1000);
    expect(deriveReminderAt(null, [])).toBeNull();
  });
});

describe('重复规则命令', () => {
  it('识别中文数字的自定义重复间隔', () => {
    expect(parseCommand('新建任务整理资料，明天截止，每三天重复')).toMatchObject({
      kind: 'create-task',
      repeatRule: 'custom',
      repeatIntervalDays: 3,
    });
  });
});
