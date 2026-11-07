import React, { useState, useEffect } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';

export default function App() {
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [activeExamId, setActiveExamId] = useState<string>('');
  const [activeCode, setActiveCode] = useState<string>('');

  // Check URL path or query parameter on load
  useEffect(() => {
    const parseUrl = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;

      // Check /thi/<examId>
      const thiMatch = pathname.match(/^\/thi\/([^/?#]+)/);
      if (thiMatch && thiMatch[1]) {
        setActiveExamId(thiMatch[1]);
        setRole('student');
        return;
      }

      // Check hash #/thi/<examId>
      const hashMatch = hash.match(/#\/?thi\/([^/?#]+)/);
      if (hashMatch && hashMatch[1]) {
        setActiveExamId(hashMatch[1]);
        setRole('student');
        return;
      }

      // Check ?exam=<examId>
      const examParam = searchParams.get('exam');
      if (examParam) {
        setActiveExamId(examParam);
        setRole('student');
        return;
      }

      // Default role is teacher as specified in Section 2
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  const handleOpenExamForStudent = (examId: string, examCode?: string) => {
    setActiveExamId(examId);
    if (examCode) setActiveCode(examCode);
    setRole('student');
    // Update browser URL without reload
    window.history.pushState({}, '', `/thi/${examId}`);
  };

  const handleRoleChange = (newRole: 'teacher' | 'student') => {
    setRole(newRole);
    if (newRole === 'teacher') {
      window.history.pushState({}, '', '/');
    } else if (activeExamId) {
      window.history.pushState({}, '', `/thi/${activeExamId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <HeaderBar currentRole={role} onChangeRole={handleRoleChange} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {role === 'teacher' ? (
          <TeacherView onOpenExamForStudent={handleOpenExamForStudent} />
        ) : (
          <StudentView initialExamId={activeExamId} initialCode={activeCode} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <div>Hệ thống Thi Online THPT — Bản quyền phục vụ kiểm tra & đánh giá học sinh</div>
          <div className="text-[11px] text-slate-400">
            Chấm điểm máy chủ chuẩn Quyết định 764 Bộ GD-ĐT · Phân tích mã QR đáp án 100% · Giám sát chống gian lận
          </div>
        </div>
      </footer>
    </div>
  );
}
