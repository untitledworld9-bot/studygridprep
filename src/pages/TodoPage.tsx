import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { addXP } from '../services/uwCore';

interface Task {
  id: string;
  text: string;
  subject: string;
  completed: boolean;
  createdAt: number;
}

export const TodoPage: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('uw_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: '1', text: 'Revise Electrostatics Formula Sheet', subject: 'Physics', completed: false, createdAt: Date.now() },
      { id: '2', text: 'Solve 20 PYQs on Coordinate Geometry', subject: 'Maths', completed: false, createdAt: Date.now() },
      { id: '3', text: 'Attempt 1 Full Mock Test on Study Grid Prep', subject: 'General', completed: false, createdAt: Date.now() }
    ];
  });

  const [inputVal, setInputVal] = useState('');
  const [selectedSub, setSelectedSub] = useState('Physics');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    localStorage.setItem('uw_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: inputVal.trim(),
      subject: selectedSub,
      completed: false,
      createdAt: Date.now()
    };
    setTasks([newTask, ...tasks]);
    setInputVal('');
  };

  const handleToggleTask = async (id: string) => {
    let wasCompleted = false;
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          wasCompleted = !t.completed;
          return { ...t, completed: wasCompleted };
        }
        return t;
      })
    );

    if (wasCompleted) {
      await addXP(10);
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } catch (e) {}
    }
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button
          onClick={() => navigate('/dashboard-home')}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text)'
          }}
        >
          <i className="fa-solid fa-arrow-left" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Daily Todo Planner</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>+10 XP for every task completed</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Progress Pill Card */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Today's Tasks</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
            {completedCount} of {tasks.length} tasks finished
          </div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
          {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleAddTask} style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Add new study goal or chapter..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: '14px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px 20px',
              borderRadius: '14px',
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </div>

        {/* Subject pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['Physics', 'Chemistry', 'Maths', 'Biology', 'General'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSub(s)}
              style={{
                padding: '4px 12px',
                borderRadius: '50px',
                border: selectedSub === s ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: selectedSub === s ? 'rgba(91,91,246,0.1)' : 'var(--surface2)',
                color: selectedSub === s ? 'var(--accent)' : 'var(--text2)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </form>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              background: filter === f ? 'var(--surface)' : 'transparent',
              color: filter === f ? 'var(--accent)' : 'var(--text3)',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'capitalize',
              cursor: 'pointer',
              boxShadow: filter === f ? 'var(--shadow-sm)' : 'none'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)' }}>
            <i className="fa-solid fa-list-check" style={{ fontSize: '28px', color: 'var(--text3)', display: 'block', marginBottom: '8px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600 }}>No tasks in this list</div>
          </div>
        ) : (
          filteredTasks.map(t => (
            <div
              key={t.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: t.completed ? 0.6 : 1,
                transition: 'all 0.18s ease'
              }}
            >
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => handleToggleTask(t.id)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--accent)',
                  cursor: 'pointer'
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    textDecoration: t.completed ? 'line-through' : 'none'
                  }}
                >
                  {t.text}
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--surface2)',
                    color: 'var(--text2)',
                    display: 'inline-block',
                    marginTop: '4px'
                  }}
                >
                  {t.subject}
                </span>
              </div>

              <button
                onClick={() => handleDeleteTask(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <i className="fa-regular fa-trash-can" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
