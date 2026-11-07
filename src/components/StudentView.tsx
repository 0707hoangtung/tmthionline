import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StudentInfo,
  StudentAnswers,
  StudentSubmission,
  ExamInfo,
  Question,
  ExamCodeData,
} from '../types';
import { MathRenderer } from './MathRenderer';
import {
  Clock,
  Send,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Menu,
  CheckCircle2,
  XCircle,
  WifiOff,
} from 'lucide-react';

interface StudentViewProps {
  initialExamId?: string;
  initialCode?: string;
}

export const StudentView: React.FC<StudentViewProps> = ({
  initialExamId = '',
  initialCode = '',
}) => {
  // Step: 'info' | 'testing' | 'result'
  const [step, setStep] = useState<'info' | 'testing' | 'result'>('info');

  // Exam list & selection
  const [examId, setExamId] = useState<string>(initialExamId);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [availableCodes, setAvailableCodes] = useState<string[]>([]);
  const [examTitle, setExamTitle] = useState<string>('');
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);

  // Student Info Form (7 mandatory fields)
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    fullName: '',
    school: 'TRƯỜNG THPT TỈNH GIA 4',
    className: '12A1',
    schoolYear: '2026-2027',
    studentId: 'SBD001',
    examCode: initialCode || '',
    room: 'Phòng 01',
  });

  const [formError, setFormError] = useState<string>('');
  const [loadingExam, setLoadingExam] = useState<boolean>(false);

  // Active testing state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<StudentAnswers>({});
  const [timeLeft, setTimeLeft] = useState<number>(90 * 60); // seconds

  // Anti-cheat state
  const [violationCount, setViolationCount] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [isExpelled, setIsExpelled] = useState<boolean>(false);

  // Submission state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<StudentSubmission | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Mobile sidebar drawer
  const [showMobileNav, setShowMobileNav] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const answersRef = useRef<StudentAnswers>(answers);
  answersRef.current = answers;

  // Load available exams from server on mount
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/exams');
        if (res.ok) {
          const data = await res.json();
          setAvailableExams(data.exams || []);
          if (!examId && data.exams && data.exams.length > 0) {
            setExamId(data.exams[0].id);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách đề thi:', err);
      }
    };
    fetchExams();
  }, []);

  // Sync initialExamId changes
  useEffect(() => {
    if (initialExamId) {
      setExamId(initialExamId);
    }
  }, [initialExamId]);

  // Sync initialCode
  useEffect(() => {
    if (initialCode) {
      setStudentInfo((prev) => ({ ...prev, examCode: initialCode }));
    }
  }, [initialCode]);

  // When examId changes, fetch sanitized exam info and available codes
  useEffect(() => {
    if (!examId) return;

    const fetchExamMetadata = async () => {
      try {
        setLoadingExam(true);
        const res = await fetch(`/api/exams/${examId}/student-view`);
        if (res.ok) {
          const data = await res.json();
          setExamTitle(data.title);
          setExamInfo(data.info);
          setAvailableCodes(data.availableCodes || []);
          if (data.availableCodes && data.availableCodes.length > 0 && !studentInfo.examCode) {
            setStudentInfo((prev) => ({ ...prev, examCode: data.availableCodes[0] }));
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin đợt thi:', err);
      } finally {
        setLoadingExam(false);
      }
    };

    fetchExamMetadata();
  }, [examId]);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Auto resubmit if pending draft exists
      const savedDraft = localStorage.getItem(`exam_pending_submit_${examId}`);
      if (savedDraft) {
        try {
          const pending = JSON.parse(savedDraft);
          submitExamToServer(pending.answers, pending.violations, pending.isExpelled);
          localStorage.removeItem(`exam_pending_submit_${examId}`);
        } catch {}
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [examId]);

  // Step 2 -> 3: Validate form and Enter Exam Room
  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Check all 7 mandatory fields
    if (
      !studentInfo.fullName.trim() ||
      !studentInfo.school.trim() ||
      !studentInfo.className.trim() ||
      !studentInfo.schoolYear.trim() ||
      !studentInfo.studentId.trim() ||
      !studentInfo.examCode.trim() ||
      !studentInfo.room.trim()
    ) {
      setFormError('Vui lòng nhập đầy đủ cả 7 thông tin thí sinh trước khi vào thi.');
      return;
    }

    if (!examId) {
      setFormError('Chưa có đợt thi nào được chọn.');
      return;
    }

    // Fetch questions for selected code (sanitized from server)
    try {
      setLoadingExam(true);
      const res = await fetch(
        `/api/exams/${examId}/student-view?code=${encodeURIComponent(studentInfo.examCode.trim())}`
      );
      if (!res.ok) {
        const errData = await res.json();
        setFormError(errData.error || 'Lỗi tải đề thi.');
        return;
      }

      const data = await res.json();
      if (!data.selectedCodeData) {
        setFormError(
          `Mã đề "${studentInfo.examCode}" không tồn tại trong đợt thi này. Các mã đề đang có: ${data.availableCodes?.join(', ') || 'không có'}.`
        );
        return;
      }

      const codeData: ExamCodeData = data.selectedCodeData;
      setQuestions(codeData.questions || []);
      setCurrentQIndex(0);

      // Restore cached draft if available
      try {
        const cached = localStorage.getItem(`exam_draft_${examId}_${studentInfo.examCode}`);
        if (cached) {
          setAnswers(JSON.parse(cached));
        } else {
          setAnswers({});
        }
      } catch {
        setAnswers({});
      }

      // Initialize duration
      const durationMins = data.info?.duration || 90;
      setTimeLeft(durationMins * 60);

      setViolationCount(0);
      setIsExpelled(false);
      setStep('testing');
    } catch (err: any) {
      setFormError(`Lỗi kết nối máy chủ: ${err.message}`);
    } finally {
      setLoadingExam(false);
    }
  };

  // Submit to Server (Server-Side Scoring)
  const submitExamToServer = useCallback(
    async (
      currentAnswers: StudentAnswers,
      currentViolations: number,
      expelled: boolean = false
    ) => {
      setIsSubmitting(true);
      setShowConfirmModal(false);

      const payload = {
        studentInfo,
        answers: currentAnswers,
        violationCount: currentViolations,
        isExpelled: expelled,
      };

      try {
        const res = await fetch(`/api/exams/${examId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Không thể nộp bài lên máy chủ.');
        }

        const data = await res.json();
        setSubmissionResult(data.submission);
        setStep('result');

        // Clear local storage cache
        localStorage.removeItem(`exam_draft_${examId}_${studentInfo.examCode}`);
      } catch (err) {
        console.error('Lỗi nộp bài:', err);
        // Save pending submit to offline cache
        localStorage.setItem(
          `exam_pending_submit_${examId}`,
          JSON.stringify({
            answers: currentAnswers,
            violations: currentViolations,
            isExpelled: expelled,
          })
        );
        alert(
          'Mất kết nối máy chủ! Bài thi đã được lưu tạm trên máy của bạn và sẽ tự động gửi lại ngay khi có mạng trở lại.'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [examId, studentInfo]
  );

  // Anti-Cheat tracking: visibilitychange & window.onblur
  useEffect(() => {
    if (step !== 'testing' || isExpelled) return;

    const handleVisibilityOrBlur = () => {
      if (document.hidden || !document.hasFocus()) {
        setViolationCount((prev) => {
          const nextCount = prev + 1;
          if (nextCount === 1) {
            setShowWarningModal(true);
          } else if (nextCount >= 2) {
            setIsExpelled(true);
            // Expel immediately and auto submit
            submitExamToServer(answersRef.current, nextCount, true);
          }
          return nextCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
    };
  }, [step, isExpelled, submitExamToServer]);

  // Countdown timer
  useEffect(() => {
    if (step !== 'testing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto submit when time runs out
          submitExamToServer(answersRef.current, violationCount, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, submitExamToServer, violationCount]);

  // Cache answers to localStorage
  const updateAnswer = (qId: string, answerPatch: any) => {
    setAnswers((prev) => {
      const next = {
        ...prev,
        [qId]: {
          ...(prev[qId] || {}),
          ...answerPatch,
        },
      };
      // Save draft
      try {
        localStorage.setItem(`exam_draft_${examId}_${studentInfo.examCode}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Helper to check if a question is answered
  const isQuestionAnswered = (q: Question): boolean => {
    const ans = answers[q.id];
    if (!ans) return false;

    if (q.type === 'part1') {
      return Boolean(ans.part1Choice);
    }
    if (q.type === 'part2') {
      const choices = ans.part2Choices || {};
      return Boolean(choices.a || choices.b || choices.c || choices.d);
    }
    if (q.type === 'part3') {
      return Boolean(ans.part3Value && ans.part3Value.trim().length > 0);
    }
    return false;
  };

  // Format time (MM:SS or HH:MM:SS)
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentQuestion = questions[currentQIndex];

  // =========================================================================
  // RENDER: STEP 1 & 2 - STUDENT INFO ENTRY
  // =========================================================================
  if (step === 'info') {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">
            {examInfo?.examTitle || 'CỔNG THI TRỰC TUYẾN'}
          </h2>
          <p className="text-sm text-slate-500">
            {examInfo?.school || 'TRƯỜNG THPT TỈNH GIA 4'} — Môn thi: {examInfo?.subject || 'Toán'} ({examInfo?.duration || 90} phút)
          </p>
        </div>

        {/* Exam selector if multiple exams exist */}
        {availableExams.length > 1 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <label className="font-semibold text-slate-700">Chọn đợt thi:</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {availableExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.info?.subject || 'Môn thi'})
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleStartExam} className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            Nhập đầy đủ 7 thông tin thí sinh:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* 1. Họ và tên */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-800 mb-1">
                1. Họ và tên thí sinh <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.fullName}
                onChange={(e) => setStudentInfo({ ...studentInfo, fullName: e.target.value })}
                placeholder="Ví dụ: Nguyễn Văn An"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* 2. Trường */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                2. Trường <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.school}
                onChange={(e) => setStudentInfo({ ...studentInfo, school: e.target.value })}
                placeholder="TRƯỜNG THPT TỈNH GIA 4"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* 3. Lớp */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                3. Lớp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.className}
                onChange={(e) => setStudentInfo({ ...studentInfo, className: e.target.value })}
                placeholder="12A1"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* 4. Năm học */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                4. Năm học <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.schoolYear}
                onChange={(e) => setStudentInfo({ ...studentInfo, schoolYear: e.target.value })}
                placeholder="2026-2027"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* 5. Số báo danh */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                5. Số báo danh <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.studentId}
                onChange={(e) => setStudentInfo({ ...studentInfo, studentId: e.target.value })}
                placeholder="SBD012"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* 6. Mã đề */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                6. Mã đề thi được giao <span className="text-rose-500">*</span>
              </label>
              {availableCodes.length > 0 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={studentInfo.examCode}
                    onChange={(e) => setStudentInfo({ ...studentInfo, examCode: e.target.value })}
                    placeholder="Ví dụ: 1011"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                  />
                  <select
                    value={studentInfo.examCode}
                    onChange={(e) => setStudentInfo({ ...studentInfo, examCode: e.target.value })}
                    className="px-2 py-2 border border-slate-300 rounded-lg bg-slate-50 text-xs"
                    title="Chọn nhanh từ danh sách mã đề của đợt thi"
                  >
                    {availableCodes.map((c) => (
                      <option key={c} value={c}>
                        Mã {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={studentInfo.examCode}
                  onChange={(e) => setStudentInfo({ ...studentInfo, examCode: e.target.value })}
                  placeholder="Ví dụ: 1011"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                />
              )}
            </div>

            {/* 7. Phòng thi */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                7. Phòng thi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentInfo.room}
                onChange={(e) => setStudentInfo({ ...studentInfo, room: e.target.value })}
                placeholder="Phòng 01"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{formError}</div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loadingExam}
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loadingExam ? 'Đang chuẩn bị đề thi...' : '🚪 VÀO THI'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // RENDER: STEP 3 - EXAM ROOM (TESTING)
  // =========================================================================
  if (step === 'testing') {
    return (
      <div className="space-y-4">
        {/* Anti-cheat Warning Modal (Violation 1) */}
        {showWarningModal && !isExpelled && (
          <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-amber-500 space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-lg font-bold text-slate-900">CẢNH BÁO VI PHẠM QUY CHẾ!</h3>
              </div>

              <div className="text-sm text-slate-700 space-y-2">
                <p className="font-semibold text-rose-700">
                  Bạn vừa rời khỏi màn hình làm bài (chuyển tab hoặc thu nhỏ trình duyệt).
                </p>
                <p>
                  Đây là lần cảnh báo thứ 1. Nếu rời màn hình thêm 1 lần nữa, bạn sẽ bị đưa ra khỏi bài thi và hệ thống sẽ tự động nộp bài!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Tôi đã hiểu — tiếp tục làm bài
              </button>
            </div>
          </div>
        )}

        {/* Expelled Modal (Violation 2) */}
        {isExpelled && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-rose-600 space-y-4 text-center">
              <div className="inline-flex p-3 rounded-full bg-rose-100 text-rose-600 mb-2">
                <XCircle className="w-10 h-10" />
              </div>

              <h3 className="text-xl font-bold text-rose-600">
                VI PHẠM QUY CHẾ THI
              </h3>

              <p className="text-sm text-slate-700">
                Bạn đã rời màn hình làm bài lần thứ 2. Bạn đã bị đưa ra khỏi phòng thi. Bài làm đã được nộp tự động với trạng thái "Vi phạm quy chế".
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep('result')}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                >
                  Xem kết quả điểm số
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Submit Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Nộp bài?</h3>
              <p className="text-sm text-slate-600">
                Bạn chắc chắn muốn nộp bài? Sau khi nộp, bạn sẽ xem điểm số ngay lập tức và không thể sửa lại câu trả lời.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy — làm tiếp
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitExamToServer(answers, violationCount, false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang chấm điểm...' : 'Nộp bài'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Floating / Sticky Header with Timer & Submit */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 sticky top-2 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Bạn có muốn quay về màn hình nhập thông tin không? Bài làm tạm thời vẫn được lưu.')) {
                  setStep('info');
                }
              }}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Về màn hình nhập thông tin</span>
            </button>

            {/* Mobile nav drawer button */}
            <button
              type="button"
              onClick={() => setShowMobileNav(!showMobileNav)}
              className="md:hidden px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>Bảng câu hỏi ({questions.length})</span>
            </button>
          </div>

          {/* Countdown Clock */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-sm">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Offline alert badge if disconnected */}
          {isOffline && (
            <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Mất mạng — Đang lưu bộ nhớ đệm</span>
            </div>
          )}

          {/* Nộp bài button */}
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>NỘP BÀI</span>
          </button>
        </div>

        {/* Official Exam Header Format */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="grid grid-cols-2 gap-4 text-xs font-sans border-b border-slate-200 pb-4">
            <div>
              <div className="text-slate-800 uppercase">{examInfo?.department || 'SỞ GD-ĐT THANH HOÁ'}</div>
              <div className="font-bold text-slate-900 uppercase">{examInfo?.school || 'TRƯỜNG THPT TỈNH GIA 4'}</div>
              <div className="text-slate-400 tracking-widest text-[10px]">--------------------------</div>
              <div className="text-slate-600 mt-2 font-medium">
                Thí sinh: <span className="font-bold text-slate-900">{studentInfo.fullName}</span> (SBD: {studentInfo.studentId}) — Lớp: {studentInfo.className}
              </div>
            </div>
            <div className="text-center space-y-0.5">
              <div className="font-bold text-slate-900 uppercase text-sm">{examInfo?.examTitle || 'KIỂM TRA GIỮA KỲ I LỚP 12'}</div>
              <div className="text-slate-700">Năm học: {examInfo?.schoolYear || '2026-2027'}</div>
              <div className="text-slate-700">Môn học: {examInfo?.subject || 'Toán'}</div>
              <div className="text-slate-700">Thời gian: {examInfo?.duration || 90} phút</div>
              <div className="italic text-slate-500 text-[11px]">(không kể thời gian phát đề)</div>
              <div className="font-bold text-blue-700 mt-2 text-xs">Mã đề: {studentInfo.examCode}</div>
            </div>
          </div>
        </div>

        {/* 2-Column Layout: Left question grid + Right question content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI: Bảng điều hướng câu hỏi */}
          <div
            className={`md:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 ${
              showMobileNav ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              <span>BẢNG CÂU HỎI</span>
              <span className="text-slate-400 font-normal">
                Đã làm:{' '}
                {
                  questions.filter((q) => isQuestionAnswered(q)).length
                }
                /{questions.length}
              </span>
            </div>

            {/* Questions Grid with Circular Number Badges */}
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-[500px] overflow-y-auto p-1 justify-items-center">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQIndex;
                const isAnswered = isQuestionAnswered(q);

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentQIndex(idx);
                      setShowMobileNav(false);
                    }}
                    className={`w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full text-xs font-bold flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 shadow-xs scale-105 font-extrabold'
                        : isAnswered
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 hover:bg-emerald-100 shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 hover:border-slate-400'
                    }`}
                    title={`Câu ${q.number}: ${isAnswered ? 'Đã làm' : 'Chưa làm'}`}
                  >
                    {q.number}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-50 border-2 border-emerald-500 inline-block" /> Đã làm
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-300 inline-block" /> Đang xem
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300 inline-block" /> Chưa làm
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Cửa sổ nội dung câu hỏi */}
          <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            {currentQuestion ? (
              <div className="space-y-6">
                {/* Header of Question */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-blue-700">
                      Câu {currentQuestion.number} / {questions.length}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {currentQuestion.type === 'part1'
                        ? 'Phần I — Trắc nghiệm nhiều lựa chọn'
                        : currentQuestion.type === 'part2'
                        ? 'Phần II — Trắc nghiệm Đúng/Sai'
                        : 'Phần III — Trắc nghiệm trả lời ngắn'}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-slate-500">
                    {currentQuestion.type === 'part1'
                      ? '0,25 điểm'
                      : currentQuestion.type === 'part2'
                      ? 'Tối đa 1,0 điểm'
                      : `${examInfo?.part3Points || 0.5} điểm`}
                  </span>
                </div>

                {/* Image before stem if configured */}
                {currentQuestion.image && currentQuestion.image.position === 'before_stem' && (
                  <div
                    className={`flex my-3 ${
                      currentQuestion.image.align === 'center'
                        ? 'justify-center'
                        : currentQuestion.image.align === 'right'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <img
                      src={currentQuestion.image.dataUrl}
                      alt={`Hình câu ${currentQuestion.number}`}
                      style={{ width: `${currentQuestion.image.width}px`, maxWidth: '100%' }}
                      className="rounded border border-slate-200"
                    />
                  </div>
                )}

                {/* Question Stem */}
                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  <MathRenderer content={currentQuestion.stem} />
                </div>

                {/* Image after stem if configured */}
                {currentQuestion.image && currentQuestion.image.position === 'after_stem' && (
                  <div
                    className={`flex my-3 ${
                      currentQuestion.image.align === 'center'
                        ? 'justify-center'
                        : currentQuestion.image.align === 'right'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <img
                      src={currentQuestion.image.dataUrl}
                      alt={`Hình câu ${currentQuestion.number}`}
                      style={{ width: `${currentQuestion.image.width}px`, maxWidth: '100%' }}
                      className="rounded border border-slate-200"
                    />
                  </div>
                )}

                {/* ========================================================
                    PHẦN I: Trắc nghiệm 4 lựa chọn A, B, C, D
                   ======================================================== */}
                {currentQuestion.type === 'part1' && currentQuestion.options && (
                  <div className="space-y-3 pt-2">
                    {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                      const optText = currentQuestion.options?.[letter] || '';
                      const isSelected = answers[currentQuestion.id]?.part1Choice === letter;

                      return (
                        <label
                          key={letter}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${currentQuestion.id}`}
                            value={letter}
                            checked={isSelected}
                            onChange={() => updateAnswer(currentQuestion.id, { part1Choice: letter })}
                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="text-xs sm:text-sm text-slate-800 flex-1">
                            <span className="font-bold mr-2 text-slate-900">{letter}.</span>
                            <MathRenderer content={optText} className="inline" />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* ========================================================
                    PHẦN II: Trắc nghiệm Đúng/Sai (mỗi ý a, b, c, d)
                   ======================================================== */}
                {currentQuestion.type === 'part2' && currentQuestion.statements && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs text-slate-500 italic">
                      Chọn Đúng (Đ) hoặc Sai (S) cho từng mệnh đề sau:
                    </div>

                    <div className="space-y-2.5">
                      {currentQuestion.statements.map((stmt) => {
                        const currentChoice = answers[currentQuestion.id]?.part2Choices?.[stmt.key];

                        return (
                          <div
                            key={stmt.key}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div className="text-xs sm:text-sm text-slate-800 flex-1">
                              <span className="font-bold mr-2 text-slate-900">{stmt.key})</span>
                              <MathRenderer content={stmt.text} className="inline" />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const curChoices = answers[currentQuestion.id]?.part2Choices || {};
                                  updateAnswer(currentQuestion.id, {
                                    part2Choices: { ...curChoices, [stmt.key]: 'Đ' },
                                  });
                                }}
                                className={`w-11 h-8 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentChoice === 'Đ'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                Đ
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const curChoices = answers[currentQuestion.id]?.part2Choices || {};
                                  updateAnswer(currentQuestion.id, {
                                    part2Choices: { ...curChoices, [stmt.key]: 'S' },
                                  });
                                }}
                                className={`w-11 h-8 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentChoice === 'S'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                S
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ========================================================
                    PHẦN III: Trắc nghiệm trả lời ngắn (nhập số)
                   ======================================================== */}
                {currentQuestion.type === 'part3' && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-sm font-bold text-slate-800">
                      Ô điền câu trả lời:
                    </label>
                    <input
                      type="text"
                      value={answers[currentQuestion.id]?.part3Value || ''}
                      onChange={(e) => updateAnswer(currentQuestion.id, { part3Value: e.target.value })}
                      className="w-full sm:w-72 px-4 py-3 border-2 border-slate-500 rounded-xl text-base font-mono font-bold text-blue-800 bg-white hover:border-slate-700 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 shadow-xs transition-colors"
                      autoComplete="off"
                    />
                  </div>
                )}

                {/* Image after options if configured */}
                {currentQuestion.image && currentQuestion.image.position === 'after_options' && (
                  <div
                    className={`flex my-3 ${
                      currentQuestion.image.align === 'center'
                        ? 'justify-center'
                        : currentQuestion.image.align === 'right'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <img
                      src={currentQuestion.image.dataUrl}
                      alt={`Hình câu ${currentQuestion.number}`}
                      style={{ width: `${currentQuestion.image.width}px`, maxWidth: '100%' }}
                      className="rounded border border-slate-200"
                    />
                  </div>
                )}

                {/* Navigation Buttons: Previous / Next */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      currentQIndex === 0
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>← Câu trước</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentQIndex === questions.length - 1}
                    onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      currentQIndex === questions.length - 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs'
                    }`}
                  >
                    <span>Câu sau →</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                Không tìm thấy câu hỏi.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: STEP 4 - RESULT VIEW (AFTER SUBMISSION)
  // =========================================================================
  if (step === 'result' && submissionResult) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 text-center">
          {/* BIG RED SCORE AT TOP AS REQUIRED */}
          <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-200 space-y-1">
            <div className="text-xs uppercase tracking-wider font-bold text-red-600">
              KẾT QUẢ BÀI THI
            </div>
            <div className="text-4xl md:text-5xl font-extrabold text-red-600 tracking-tight">
              ĐIỂM: {submissionResult.score10.toFixed(1).replace('.', ',')} / 10
            </div>
            <div className="text-xs text-red-700 font-medium">
              (Điểm thô: {submissionResult.rawScore} / {submissionResult.maxRawScore})
            </div>
          </div>

          {/* Details breakdown per section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1">
              <div className="font-bold text-slate-800">Phần I (Trắc nghiệm):</div>
              <div className="text-slate-600">
                Đúng {submissionResult.correctPart1Count} / {submissionResult.totalPart1} câu
              </div>
              <div className="font-semibold text-blue-600">
                Điểm: {submissionResult.scorePart1} điểm
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1">
              <div className="font-bold text-slate-800">Phần II (Đúng/Sai):</div>
              <div className="text-slate-600">
                Đúng {submissionResult.correctPart2ItemCount} / {submissionResult.totalPart2 * 4} ý
              </div>
              <div className="font-semibold text-blue-600">
                Điểm: {submissionResult.scorePart2} điểm
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1">
              <div className="font-bold text-slate-800">Phần III (Trả lời ngắn):</div>
              <div className="text-slate-600">
                Đúng {submissionResult.correctPart3Count} / {submissionResult.totalPart3} câu
              </div>
              <div className="font-semibold text-blue-600">
                Điểm: {submissionResult.scorePart3} điểm
              </div>
            </div>
          </div>

          {/* All 7 Student Information fields */}
          <div className="text-left border-t border-slate-100 pt-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Thông tin thí sinh:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500">Họ và tên:</span>{' '}
                <span className="font-bold text-slate-900">{submissionResult.studentInfo.fullName}</span>
              </div>
              <div>
                <span className="text-slate-500">Trường:</span>{' '}
                <span className="font-semibold text-slate-800">{submissionResult.studentInfo.school}</span>
              </div>
              <div>
                <span className="text-slate-500">Lớp:</span>{' '}
                <span className="font-semibold text-slate-800">{submissionResult.studentInfo.className}</span>
              </div>
              <div>
                <span className="text-slate-500">Năm học:</span>{' '}
                <span className="font-semibold text-slate-800">{submissionResult.studentInfo.schoolYear}</span>
              </div>
              <div>
                <span className="text-slate-500">Số báo danh:</span>{' '}
                <span className="font-mono font-bold text-blue-700">{submissionResult.studentInfo.studentId}</span>
              </div>
              <div>
                <span className="text-slate-500">Mã đề:</span>{' '}
                <span className="font-bold text-slate-900">{submissionResult.studentInfo.examCode}</span>
              </div>
              <div>
                <span className="text-slate-500">Phòng thi:</span>{' '}
                <span className="font-semibold text-slate-800">{submissionResult.studentInfo.room}</span>
              </div>
              <div>
                <span className="text-slate-500">Trạng thái:</span>{' '}
                <span className={`font-semibold ${submissionResult.status.includes('Vi phạm') ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {submissionResult.status}
                </span>
              </div>
              {submissionResult.violationCount > 0 && (
                <div className="sm:col-span-2 text-rose-600 font-semibold">
                  Số lần vi phạm quy chế (rời màn hình): {submissionResult.violationCount} lần
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('info');
                setSubmissionResult(null);
              }}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Về trang đăng nhập thi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
