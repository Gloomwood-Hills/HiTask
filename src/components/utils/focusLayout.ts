/** 重复任务先放左栏；其余任务按当前卡片数补入较空的一栏。 */
export function distributeFocusTasks<T extends { repeatSeriesId: string | null }>(tasks: T[]): [T[], T[]] {
  const left = tasks.filter((task) => task.repeatSeriesId !== null);
  const right: T[] = [];
  const regular = tasks.filter((task) => task.repeatSeriesId === null);
  regular.forEach((task) => {
    if (left.length <= right.length) left.push(task);
    else right.push(task);
  });
  return [left, right];
}
