import { CheckCircle2 } from 'lucide-react';
import { TaskWithSubtasks } from '../data/types';
import TaskItem from './taskItem';
import { isMobile } from '../data/platform';

interface FocusSectionProps {
  tasks: TaskWithSubtasks[];
  expandedTasks: Set<string>;
  onToggleExpanded: (id: string) => void;
  onToggleCompleted: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, taskId: string) => void;
  deadlineGradient: boolean;
  dark: boolean;
}

/** 每日焦点卡片：按任务顺序在单栏中展示。 */
export default function FocusSection({ tasks, expandedTasks, onToggleExpanded, onToggleCompleted, onContextMenu, deadlineGradient, dark }: FocusSectionProps) {
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
  const parentNames = new Map<string, string>();
  const walk = (items: TaskWithSubtasks[], parentTitle?: string) => items.forEach((item) => {
    if (parentTitle) parentNames.set(item.id, parentTitle);
    walk(item.subtasks ?? [], item.title);
  });
  walk(tasks);

  const renderCard = (task: TaskWithSubtasks) => {
    const parentTitle = parentNames.get(task.id);
    const isRepeated = task.repeatSeriesId !== null;
    const accent = isRepeated ? '#2da04e' : task.priority === 'important' ? '#ff6b3d' : null;
    return (
      <article key={task.id} className={`focus-task-card${isMobile ? ' is-mobile' : ''}${expandedTasks.has(task.id) ? ' is-expanded' : ''}${isRepeated ? ' is-repeated' : ''}`} style={{ minHeight: 82, padding: 'clamp(7px, 1.2vw, 12px)', borderRadius: 20, background: accent ? `color-mix(in srgb, ${accent} 15%, var(--card))` : 'color-mix(in srgb, var(--card) 96%, var(--background))', border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 42%, var(--border))` : 'color-mix(in srgb, var(--border) 72%, transparent)'}`, boxShadow: isMobile ? 'none' : '0 12px 28px color-mix(in srgb, var(--foreground) 12%, transparent), 0 3px 9px color-mix(in srgb, var(--foreground) 5%, transparent)', cursor: 'pointer', transition: 'max-height 220ms ease, transform 180ms ease, box-shadow 180ms ease' }}>
        {(parentTitle || task.subtasks.length > 0) && (
          <div className="focus-card-parent" style={{ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', margin: '0 2px 5px', padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 11%, transparent)', color: 'var(--primary)', fontSize: 11, fontWeight: 650, lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
            {parentTitle ? `父任务 · ${parentTitle}` : '父任务'}
          </div>
        )}
        <TaskItem task={task} expandedSet={expandedTasks} onToggleExpanded={onToggleExpanded} onToggleCompleted={onToggleCompleted} onContextMenu={onContextMenu} searchQuery="" deadlineGradient={deadlineGradient} dark={dark} focusRepeatOnly={isRepeated} focusHoverDetails={!isMobile} />
      </article>
    );
  };

  return (
    <section style={{ width: 'min(820px, 100%)', margin: '0 auto', padding: 'clamp(8px, 2vw, 24px) 0 28px' }}>
      <header style={{ padding: '8px 10px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 11px', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>{dateLabel}</div>
        <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', margin: '14px 0 0', letterSpacing: '-0.035em', fontSize: 'clamp(24px, 4vw, 32px)', lineHeight: 1.12 }}><span>今日值得看这</span><span style={{ color: '#0a84ff', fontWeight: 750 }}>{tasks.length}</span><span>件事</span></h1>
      </header>
      {tasks.length ? (
        <div className="focus-card-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'clamp(10px, 1.8vw, 16px)', padding: '0 clamp(2px, 1vw, 8px)' }}>
          {tasks.map(renderCard)}
        </div>
      ) : (
        <div aria-label="暂无焦点任务" style={{ display: 'grid', justifyItems: 'center', padding: '42px 20px', borderRadius: 22, background: 'color-mix(in srgb, var(--card) 92%, var(--background))', border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)' }}><CheckCircle2 style={{ width: 34, height: 34, color: '#30d158' }} /></div>
      )}
    </section>
  );
}
