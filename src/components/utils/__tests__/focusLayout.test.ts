import { describe, expect, it } from 'vitest';
import { distributeFocusTasks } from '../focusLayout';

describe('焦点卡片双栏分配', () => {
  it('只有一张重复卡片时，普通卡片继续填充左栏', () => {
    const tasks = [
      { id: 'r', repeatSeriesId: 'r' },
      { id: 'a', repeatSeriesId: null },
      { id: 'b', repeatSeriesId: null },
      { id: 'c', repeatSeriesId: null },
      { id: 'd', repeatSeriesId: null },
    ];
    const [left, right] = distributeFocusTasks(tasks);
    expect(left.map((task) => task.id)).toEqual(['r', 'b', 'd']);
    expect(right.map((task) => task.id)).toEqual(['a', 'c']);
  });

  it('无重复卡片时同样保持两栏交替', () => {
    const tasks = ['a', 'b', 'c', 'd'].map((id) => ({ id, repeatSeriesId: null }));
    const [left, right] = distributeFocusTasks(tasks);
    expect(left.map((task) => task.id)).toEqual(['a', 'c']);
    expect(right.map((task) => task.id)).toEqual(['b', 'd']);
  });

  it('两张重复卡片时先补右栏，避免左栏堆积', () => {
    const tasks = [
      { id: 'r1', repeatSeriesId: 'r1' },
      { id: 'r2', repeatSeriesId: 'r2' },
      { id: 'a', repeatSeriesId: null },
      { id: 'b', repeatSeriesId: null },
    ];
    const [left, right] = distributeFocusTasks(tasks);
    expect(left.map((task) => task.id)).toEqual(['r1', 'r2']);
    expect(right.map((task) => task.id)).toEqual(['a', 'b']);
  });
});
