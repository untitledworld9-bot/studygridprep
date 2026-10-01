import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Video {
  id: string;
  title: string;
  teacher: string;
  duration: string;
  videoId: string;
  subject: string;
}

export const PlaylistPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeSubject, setActiveSubject] = useState('Physics');
  const [selectedVideo, setSelectedVideo] = useState<Video>({
    id: '1',
    title: 'Electrostatics & Gauss Law in One Shot',
    teacher: 'Prof. Sharma',
    duration: '1h 24m',
    videoId: 'kJQP7kiw5Fk', // YouTube embed id
    subject: 'Physics'
  });

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const playlistVideos: Video[] = [
    { id: '1', title: 'Electrostatics & Gauss Law in One Shot', teacher: 'Prof. Sharma', duration: '1h 24m', videoId: 'kJQP7kiw5Fk', subject: 'Physics' },
    { id: '2', title: 'Current Electricity & Kirchhoffs Laws', teacher: 'Prof. Verma', duration: '58m', videoId: 'kJQP7kiw5Fk', subject: 'Physics' },
    { id: '3', title: 'Chemical Kinetics & Rate of Reaction', teacher: 'Dr. Mukherjee', duration: '1h 12m', videoId: 'kJQP7kiw5Fk', subject: 'Chemistry' },
    { id: '4', title: 'Coordination Compounds Masterclass', teacher: 'Dr. Anita', duration: '1h 40m', videoId: 'kJQP7kiw5Fk', subject: 'Chemistry' },
    { id: '5', title: 'Definite Integration & Properties', teacher: 'Er. Gupta', duration: '1h 30m', videoId: 'kJQP7kiw5Fk', subject: 'Maths' },
    { id: '6', title: 'Vectors & 3D Geometry PYQs', teacher: 'Er. Gupta', duration: '1h 05m', videoId: 'kJQP7kiw5Fk', subject: 'Maths' }
  ];

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setIsAsking(true);
    setAiAnswer(null);

    setTimeout(() => {
      setIsAsking(false);
      setAiAnswer(
        `Key Concept Explanation for: "${aiQuestion}"\n` +
        `In ${selectedVideo.subject}, this problem typically resolves by applying conservation principles and standard formula substitution. ` +
        `Make sure to check boundary conditions and sign conventions before finalizing your result.`
      );
    }, 700);
  };

  const filteredVideos = playlistVideos.filter(v => v.subject === activeSubject);

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
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Study Playlist</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Distraction-Free Video Lessons</div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Embedded Video Player */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%',
          background: '#000',
          borderRadius: '18px',
          overflow: 'hidden',
          marginBottom: '12px',
          boxShadow: 'var(--shadow)'
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?rel=0&modestbranding=1`}
          title={selectedVideo.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      </div>

      {/* Video Details */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
          {selectedVideo.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text2)' }}>
          <span>{selectedVideo.teacher}</span>
          <span>•</span>
          <span>{selectedVideo.duration}</span>
          <span>•</span>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedVideo.subject}</span>
        </div>
      </div>

      {/* Subject Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
        {['Physics', 'Chemistry', 'Maths'].map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubject(sub)}
            style={{
              padding: '7px 16px',
              borderRadius: '50px',
              border: activeSubject === sub ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: activeSubject === sub ? 'rgba(91,91,246,0.1)' : 'var(--surface)',
              color: activeSubject === sub ? 'var(--accent)' : 'var(--text2)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Video Lessons List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {filteredVideos.map(v => {
          const isSelected = selectedVideo.id === v.id;
          return (
            <div
              key={v.id}
              onClick={() => setSelectedVideo(v)}
              style={{
                background: isSelected ? 'rgba(91,91,246,0.08)' : 'var(--surface)',
                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '16px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                  color: isSelected ? '#fff' : 'var(--text2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-play" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  {v.teacher} • {v.duration}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ask AI Doubt Box */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid rgba(91,91,246,0.25)',
          borderRadius: '20px',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <i className="fa-solid fa-robot" style={{ color: 'var(--accent)', fontSize: '16px' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            Ask AI Doubt Solver
          </span>
        </div>

        <form onSubmit={handleAskAI} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Ask a doubt about this lesson..."
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isAsking}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {isAsking ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {aiAnswer && (
          <div
            style={{
              marginTop: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--surface2)',
              fontSize: '12.5px',
              color: 'var(--text)',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap'
            }}
          >
            {aiAnswer}
          </div>
        )}
      </div>
    </div>
  );
};
