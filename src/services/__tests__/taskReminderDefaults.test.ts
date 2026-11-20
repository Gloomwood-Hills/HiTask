import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskService } from '../TaskService';
import { TaskRepository } from '../../data/repositories/TaskRepository';
import type { Task } from '../../data/types';

afterEach(() => vi.restoreAllMocks());

describe('编辑任务后的截止提醒', () => {
  it('空自定义提醒列表不应取消默认的截止时间提醒', async () => {
    const deadline = Date.now() + 3_600_000;
    const task = { id: 'task-1', deadline, reminderAt: null, reminderOffsets: [], reminderTimes: [], repeatSeriesId: null } as Task;
    vi.spyOn(TaskRepository.prototype, 'getById').mockResolvedValue(task);
    const update = vi.spyOn(TaskRepository.prototype, 'update').mockResolvedValue(task);

    await new TaskService({} as ConstructorParameters<typeof TaskService>[0]).updateTask(task.id, {
      deadline,
      reminderOffsets: [],
      reminderTimes: [],
    });

    expect(update).toHaveBeenCalledWith(task.id, expect.objectContaining({
      reminderAt: deadline,
      reminderTimes: [],
      reminderFired: false,
    }));
  });

  it('有自定义提醒时间时不再额外派生单次提醒', async () => {
    const deadline = Date.now() + 3_600_000;
    const customTime = deadline - 1_800_000;
    const task = { id: 'task-2', deadline, reminderAt: deadline, reminderOffsets: [], reminderTimes: [], repeatSeriesId: null } as Task;
    vi.spyOn(TaskRepository.prototype, 'getById').mockResolvedValue(task);
    const update = vi.spyOn(TaskRepository.prototype, 'update').mockResolvedValue(task);

    await new TaskService({} as ConstructorParameters<typeof TaskService>[0]).updateTask(task.id, {
      deadline,
      reminderTimes: [customTime],
    });

    expect(update).toHaveBeenCalledWith(task.id, expect.objectContaining({
      reminderAt: null,
      reminderTimes: [customTime],
      reminderFired: false,
    }));
  });

  it('提前提醒之外，截止时间也会提醒一次', async () => {
    const deadline = Date.now() - 1_000;
    const task = {
      id: 'task-3', deadline, reminderAt: deadline - 3_600_000,
      reminderOffsets: ['1h'], reminderFiredOffsets: ['1h'],
      reminderTimes: [], reminderFiredTimes: [], reminderFired: false,
    } as Task;
    vi.spyOn(TaskRepository.prototype, 'getReminderCandidates').mockResolvedValue([task]);

    const due = await new TaskService({} as ConstructorParameters<typeof TaskService>[0]).getDueReminders(Date.now());
    expect(due).toEqual([{ task, offsetKey: 'deadline', reminderTime: null }]);
  });
});
