import React from 'react';
import { GraduationCap, Users } from 'lucide-react';

interface HeaderBarProps {
  currentRole: 'teacher' | 'student';
  onChangeRole: (role: 'teacher' | 'student') => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ currentRole, onChangeRole }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            TM
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">
              HỆ THỐNG THI ONLINE THPT
            </div>
            <div className="text-[11px] text-slate-500 hidden sm:block">
              Đồng bộ dữ liệu giáo viên & học sinh theo thời gian thực
            </div>
          </div>
        </div>

        {/* Role Switch Buttons as requested */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => onChangeRole('teacher')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentRole === 'teacher'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>👩‍🏫</span>
            <span>GIÁO VIÊN</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeRole('student')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentRole === 'student'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🧑‍🎓</span>
            <span>HỌC SINH</span>
          </button>
        </div>
      </div>
    </header>
  );
};
