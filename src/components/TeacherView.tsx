import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  ExamInfo,
  ExamCodeData,
  Question,
  ParsedQRAnswers,
  CrossCheckResult,
  StudentSubmission,
} from '../types';
import { parseDocxFile, parseJSONExamFile } from '../utils/docxParser';
import { parseQRString, performCrossCheck } from '../utils/qrParser';
import { exportSubmissionsToExcel } from '../utils/excelExporter';
import { downloadSampleQRImage, downloadSampleExamJSON } from '../utils/sampleData';
import { MathRenderer } from './MathRenderer';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Save,
  Copy,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Lock,
  Unlock,
  Edit2,
  Check,
  X,
  Search,
  Download,
} from 'lucide-react';

interface TeacherViewProps {
  onOpenExamForStudent: (examId: string, examCode?: string) => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ onOpenExamForStudent }) => {
  // 4.2 Exam info form (6 fields, defaults as required)
  const [examInfo, setExamInfo] = useState<ExamInfo>({
    department: 'SỞ GD-ĐT THANH HOÁ',
    school: 'TRƯỜNG THPT TỈNH GIA 4',
    examTitle: 'KIỂM TRA GIỮA KỲ I LỚP 12',
    schoolYear: '2026-2027',
    subject: 'Toán',
    duration: 90,
    part3Points: 0.5,
  });

  // Loaded exam codes from file
  const [codesData, setCodesData] = useState<Record<string, ExamCodeData>>({});
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [mathTypeWarning, setMathTypeWarning] = useState<string>('');

  // QR parsing state
  const [qrStatus, setQrStatus] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');
  const [parsedQR, setParsedQR] = useState<ParsedQRAnswers | null>(null);
  const [crossCheck, setCrossCheck] = useState<CrossCheckResult | null>(null);
  const [rawQRString, setRawQRString] = useState<string>('');

  // Saved exam state & link
  const [savedExamId, setSavedExamId] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Submissions table state
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCode, setFilterCode] = useState<string>('all');
  const [sortByScore, setSortByScore] = useState<'desc' | 'asc' | 'none'>('desc');

  // Editing state for questions
  const [editingStemQId, setEditingStemQId] = useState<string | null>(null);
  const [tempStemText, setTempStemText] = useState<string>('');

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const examFileInputRef = useRef<HTMLInputElement | null>(null);

  // Poll submissions when savedExamId is set
  useEffect(() => {
    if (!savedExamId) return;

    const fetchSubmissions = async () => {
      try {
        const res = await fetch(`/api/exams/${savedExamId}/submissions`);
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions || []);
        }
      } catch (err) {
        console.error('Lỗi tải kết quả thi:', err);
      }
    };

    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 3000);
    return () => clearInterval(interval);
  }, [savedExamId]);

  // Run cross-check whenever codesData or parsedQR changes
  useEffect(() => {
    if (Object.keys(codesData).length > 0 && parsedQR) {
      const result = performCrossCheck(codesData, parsedQR);
      setCrossCheck(result);
    } else {
      setCrossCheck(null);
    }
  }, [codesData, parsedQR]);

  // Select first code when codes are loaded
  useEffect(() => {
    const keys = Object.keys(codesData);
    if (keys.length > 0 && (!selectedCode || !codesData[selectedCode])) {
      setSelectedCode(keys[0]);
    }
  }, [codesData, selectedCode]);

  // Handle Exam File Upload (.docx or .json)
  const handleExamFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Đang đọc file đề thi...');
    setUploadError('');
    setMathTypeWarning('');

    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const res = parseJSONExamFile(text);
        if (!res.success) {
          setUploadError(res.error || 'Lỗi đọc file JSON');
          setUploadStatus('');
          return;
        }
        setCodesData(res.codes);
        setUploadStatus(`Đã tải thành công ${Object.keys(res.codes).length} mã đề từ file JSON.`);
      } else if (fileName.endsWith('.docx')) {
        const res = await parseDocxFile(file);
        if (!res.success) {
          setUploadError(res.error || 'Lỗi đọc file Word .docx');
          setUploadStatus('');
          return;
        }
        setCodesData(res.codes);
        setUploadStatus(
          `Đã tải thành công ${Object.keys(res.codes).length} mã đề từ file Word (${res.detectedImagesCount} hình ảnh).`
        );
        if (res.hasMathTypeWarning) {
          setMathTypeWarning(res.mathTypeDetails || 'File chứa công thức MathType không chuẩn.');
        }
      } else {
        setUploadError('Chỉ chấp nhận file Word (.docx) hoặc file JSON (.json) do app số 1 xuất ra.');
        setUploadStatus('');
      }
    } catch (err: any) {
      setUploadError(`Lỗi khi xử lý file: ${err.message || 'Không xác định'}`);
      setUploadStatus('');
    }
  };

  // Handle QR image file upload & jsQR scanning
  const handleQRImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrStatus('Đang quét mã QR từ ảnh...');
    setQrError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = qrCanvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setQrError('Không khởi tạo được canvas giải mã.');
          return;
        }

        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (qrCode && qrCode.data) {
          const rawStr = qrCode.data.trim();
          setRawQRString(rawStr);

          // Parse JSON
          const parsed = parseQRString(rawStr);
          if (!parsed.success || !parsed.data) {
            setQrError(parsed.error || 'Mã QR không đúng định dạng chuẩn.');
            setQrStatus('');
            setParsedQR(null);
            return;
          }

          setParsedQR(parsed.data);
          setQrStatus(`Đã quét và giải mã thành công đáp án cho ${Object.keys(parsed.data).length} mã đề.`);

          // Apply parsed answers to codesData
          applyQRAnswersToCodes(parsed.data);
        } else {
          setQrError('Không nhận diện được mã QR trong ảnh. Vui lòng kiểm tra ảnh rõ nét và không bị lóa.');
          setQrStatus('');
          setParsedQR(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Apply parsed answers into codesData
  const applyQRAnswersToCodes = (qrAnswers: ParsedQRAnswers) => {
    setCodesData((prev) => {
      const next = { ...prev };
      for (const code of Object.keys(next)) {
        const qr = qrAnswers[code];
        if (!qr) continue;

        const updatedQuestions = next[code].questions.map((q) => {
          const qCopy = { ...q };
          if (q.type === 'part1') {
            const p1Idx = next[code].questions.filter((x) => x.type === 'part1').indexOf(q);
            if (p1Idx >= 0 && p1Idx < qr.part1.length) {
              qCopy.correctAnswer = qr.part1[p1Idx];
            }
          } else if (q.type === 'part2') {
            const p2Idx = next[code].questions.filter((x) => x.type === 'part2').indexOf(q);
            if (p2Idx >= 0 && p2Idx < qr.part2.length) {
              qCopy.correctAnswers = { ...qr.part2[p2Idx] };
            }
          } else if (q.type === 'part3') {
            const p3Idx = next[code].questions.filter((x) => x.type === 'part3').indexOf(q);
            if (p3Idx >= 0 && p3Idx < qr.part3.length) {
              qCopy.correctAnswer = qr.part3[p3Idx];
            }
          }
          return qCopy;
        });

        next[code] = {
          ...next[code],
          questions: updatedQuestions,
        };
      }
      return next;
    });
  };

  // Sync edits in question back to parsedQR & codesData
  const updateQuestionAnswer = (code: string, questionId: string, updates: Partial<Question>) => {
    setCodesData((prev) => {
      const currentExam = prev[code];
      if (!currentExam) return prev;

      const questions = currentExam.questions.map((q) => {
        if (q.id === questionId) {
          return { ...q, ...updates };
        }
        return q;
      });

      return {
        ...prev,
        [code]: {
          ...currentExam,
          questions,
        },
      };
    });
  };

  // 7.1 Stem edit handlers
  const startEditingStem = (q: Question) => {
    setEditingStemQId(q.id);
    setTempStemText(q.stem);
  };

  const saveEditingStem = (code: string, qId: string) => {
    updateQuestionAnswer(code, qId, { stem: tempStemText });
    setEditingStemQId(null);
  };

  const cancelEditingStem = () => {
    setEditingStemQId(null);
    setTempStemText('');
  };

  // 7.5 Delete question handler
  const deleteQuestion = (code: string, qId: string, qNumber: number) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Câu ${qNumber}?`)) {
      return;
    }

    setCodesData((prev) => {
      const currentExam = prev[code];
      if (!currentExam) return prev;

      const filteredQuestions = currentExam.questions.filter((q) => q.id !== qId);
      // Re-number questions
      const renumbered = filteredQuestions.map((q, idx) => ({ ...q, number: idx + 1 }));

      const p1 = renumbered.filter((q) => q.type === 'part1');
      const p2 = renumbered.filter((q) => q.type === 'part2');
      const p3 = renumbered.filter((q) => q.type === 'part3');

      return {
        ...prev,
        [code]: {
          ...currentExam,
          questions: renumbered,
          part1Count: p1.length,
          part2Count: p2.length,
          part3Count: p3.length,
          maxRawPoints: p1.length * 0.25 + p2.length * 1.0 + p3.length * examInfo.part3Points,
        },
      };
    });
  };

  // 7.6 Image adjustments handler
  const updateImageSettings = (
    code: string,
    qId: string,
    settings: {
      position?: 'before_stem' | 'after_stem' | 'after_options';
      align?: 'left' | 'center' | 'right';
      width?: number;
    }
  ) => {
    setCodesData((prev) => {
      const currentExam = prev[code];
      if (!currentExam) return prev;

      const questions = currentExam.questions.map((q) => {
        if (q.id === qId && q.image) {
          return {
            ...q,
            image: {
              ...q.image,
              ...settings,
            },
          };
        }
        return q;
      });

      return {
        ...prev,
        [code]: { ...currentExam, questions },
      };
    });
  };

  // Save All Exams
  const handleSaveAllExams = async () => {
    if (!crossCheck || !crossCheck.valid) {
      alert('Không thể lưu đề thi vì kiểm tra chéo chưa đạt. Vui lòng kiểm tra lại số lượng hoặc đáp án các câu.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          info: examInfo,
          codes: codesData,
          parsedQR,
          qrJsonRaw: rawQRString,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Lỗi lưu đề thi.');
      }

      setSavedExamId(resData.examId);
      setSaveSuccessMsg('Đã lưu thành công tất cả các mã đề vào hệ thống!');
    } catch (err: any) {
      alert(`Lỗi khi lưu đề thi: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy unique link
  const examLink = savedExamId
    ? `${window.location.origin}/thi/${savedExamId}`
    : '';

  const handleCopyLink = () => {
    if (!examLink) return;
    navigator.clipboard.writeText(examLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Clear all submissions
  const handleClearSubmissions = async () => {
    if (!savedExamId) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả kết quả bài thi này không?')) return;

    try {
      const res = await fetch(`/api/exams/${savedExamId}/submissions`, { method: 'DELETE' });
      if (res.ok) {
        setSubmissions([]);
      }
    } catch (err) {
      console.error('Lỗi khi xóa kết quả:', err);
    }
  };

  // Filtered and sorted submissions
  const filteredSubmissions = submissions
    .filter((sub) => {
      const matchSearch =
        sub.studentInfo.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.studentInfo.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.studentInfo.className.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCode = filterCode === 'all' || sub.studentInfo.examCode === filterCode;
      return matchSearch && matchCode;
    })
    .sort((a, b) => {
      if (sortByScore === 'desc') return b.score10 - a.score10;
      if (sortByScore === 'asc') return a.score10 - b.score10;
      return 0;
    });

  const currentCodeData = selectedCode ? codesData[selectedCode] : null;

  return (
    <div className="space-y-8">
      <canvas ref={qrCanvasRef} className="hidden" />

      {/* 2-Column Grid (50/50, stacked on < 1000px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* =========================================
            LEFT COLUMN: TẢI ĐỀ + THÔNG TIN + MÃ QR
           ========================================= */}
        <div className="space-y-6">
          {/* 4.1 TẢI ĐỀ THI */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>TẢI ĐỀ THI</span>
              <span className="text-xs font-normal text-slate-500">File .docx hoặc .json</span>
            </h2>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Chọn file đề thi (.docx / .json)</span>
                  <input
                    ref={examFileInputRef}
                    type="file"
                    accept=".docx,.json"
                    onChange={handleExamFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => downloadSampleExamJSON()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Tải file JSON mẫu (mã 1011 & 1012 chuẩn 12 TN, 4 Đ/S, 3 ngắn) để kiểm tra tải lên"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tải file đề mẫu test (.json)</span>
                </button>
              </div>

              {uploadStatus && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  {uploadStatus}
                </div>
              )}

              {uploadError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {uploadError}
                </div>
              )}

              {mathTypeWarning && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Lưu ý về công thức MathType:</span>
                  </div>
                  <p>{mathTypeWarning}</p>
                </div>
              )}

              {/* Summary per code */}
              {Object.keys(codesData).length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Tóm tắt các mã đề đã tải:</div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {Object.values(codesData).map((c) => {
                      const hasQR = parsedQR && parsedQR[c.code];
                      return (
                        <div
                          key={c.code}
                          className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-900">Mã đề {c.code}</span>
                            <span className="text-slate-500 ml-2">
                              — Phần I: {c.part1Count} câu, Phần II: {c.part2Count} câu, Phần III: {c.part3Count} câu.
                            </span>
                            <span className="text-slate-600 ml-1 font-medium">
                              (Điểm tối đa: {c.part1Count * 0.25 + c.part2Count * 1.0 + c.part3Count * examInfo.part3Points} điểm thô)
                            </span>
                          </div>
                          <div>
                            {hasQR ? (
                              <span className="text-emerald-600 font-medium flex items-center gap-1 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Có đáp án
                              </span>
                            ) : (
                              <span className="text-amber-600 font-medium text-xs">
                                Chưa có đáp án (cần mã QR)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part III Points Choice */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  Điểm cho Phần III (Trả lời ngắn):
                </span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="part3Points"
                      value="0.5"
                      checked={examInfo.part3Points === 0.5}
                      onChange={() => setExamInfo((prev) => ({ ...prev, part3Points: 0.5 }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>0,5 điểm / câu</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="part3Points"
                      value="1.0"
                      checked={examInfo.part3Points === 1.0}
                      onChange={() => setExamInfo((prev) => ({ ...prev, part3Points: 1.0 }))}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>1 điểm / câu</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 4.2 THÔNG TIN ĐỀ THI */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              📋 Thông tin đề thi
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Sở GD-ĐT</label>
                <input
                  type="text"
                  value={examInfo.department}
                  onChange={(e) => setExamInfo({ ...examInfo, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="SỞ GD-ĐT THANH HOÁ"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Trường</label>
                <input
                  type="text"
                  value={examInfo.school}
                  onChange={(e) => setExamInfo({ ...examInfo, school: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="TRƯỜNG THPT TỈNH GIA 4"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên bài kiểm tra</label>
                <input
                  type="text"
                  value={examInfo.examTitle}
                  onChange={(e) => setExamInfo({ ...examInfo, examTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="KIỂM TRA GIỮA KỲ I LỚP 12"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Năm học</label>
                <input
                  type="text"
                  value={examInfo.schoolYear}
                  onChange={(e) => setExamInfo({ ...examInfo, schoolYear: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="2026-2027"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Môn học</label>
                <input
                  type="text"
                  value={examInfo.subject}
                  onChange={(e) => setExamInfo({ ...examInfo, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  placeholder="Toán"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Thời gian (phút, 1–180)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={examInfo.duration}
                  onChange={(e) => setExamInfo({ ...examInfo, duration: parseInt(e.target.value) || 90 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Live-updated header box */}
            <div className="mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                Xem trước đầu đề hiển thị:
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-sans border-b border-slate-200 pb-4">
                <div>
                  <div className="text-slate-800 uppercase">{examInfo.department || 'SỞ GD-ĐT...'}</div>
                  <div className="font-bold text-slate-900 uppercase">{examInfo.school || 'TRƯỜNG...'}</div>
                  <div className="text-slate-400 tracking-widest text-[10px]">--------------------------</div>
                </div>
                <div className="text-center space-y-0.5">
                  <div className="font-bold text-slate-900 uppercase text-sm">{examInfo.examTitle || 'BÀI KIỂM TRA'}</div>
                  <div className="text-slate-700">Năm học: {examInfo.schoolYear || '...'}</div>
                  <div className="text-slate-700">Môn học: {examInfo.subject || '...'}</div>
                  <div className="text-slate-700">Thời gian: {examInfo.duration} phút</div>
                  <div className="italic text-slate-500 text-[11px]">(không kể thời gian phát đề)</div>
                </div>
              </div>
            </div>
          </div>

          {/* 4.3 TẢI ĐÁP ÁN MÃ QR */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              TẢI ĐÁP ÁN MÃ QR
            </h2>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-xs">
                  <QrCode className="w-4 h-4" />
                  <span>Tải ảnh mã QR đáp án (PNG/JPG)</span>
                  <input
                    ref={qrFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQRImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => downloadSampleQRImage()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>⬇️ Tải ảnh mã QR mẫu về máy để test</span>
                </button>
              </div>

              {qrStatus && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{qrStatus}</div>
                </div>
              )}

              {qrError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{qrError}</div>
                </div>
              )}

              {/* Cross-check report */}
              {crossCheck && (
                <div className={`text-xs rounded-lg p-4 border ${crossCheck.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    {crossCheck.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Kiểm tra chéo 2 lớp đạt 100%! Sẵn sàng lưu đề.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Phát hiện lỗi kiểm tra chéo ({crossCheck.errors.length} lỗi):</span>
                      </>
                    )}
                  </div>

                  {!crossCheck.valid && (
                    <ul className="list-disc list-inside space-y-1 mt-2 text-[11px]">
                      {crossCheck.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Save All Exams button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!crossCheck || !crossCheck.valid || isSaving}
                  onClick={handleSaveAllExams}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                    crossCheck && crossCheck.valid
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'ĐANG LƯU DỮ LIỆU...' : '💾 LƯU TẤT CẢ CÁC ĐỀ'}</span>
                </button>

                {saveSuccessMsg && (
                  <div className="text-xs text-center text-emerald-700 font-medium mt-2">
                    {saveSuccessMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT COLUMN: 4.4 XEM LẠI TỪNG MÃ ĐỀ
           ========================================= */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">
              🔍 Xem lại từng mã đề (kiểm soát độ chính xác)
            </h2>
          </div>

          {/* Exam Code Selector tabs */}
          {Object.keys(codesData).length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Chưa có mã đề nào được tải lên. Vui lòng tải file đề thi ở cột bên trái.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.keys(codesData).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedCode(code)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                      selectedCode === code
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Mã {code}
                  </button>
                ))}
              </div>

              {/* Header preview of selected code */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">Mã đề: {selectedCode}</span>
                  <span className="text-slate-500 ml-2">
                    (Tổng số câu: {currentCodeData?.questions.length || 0})
                  </span>
                </div>
                <div className="text-slate-600 font-medium">
                  Điểm tối đa: {currentCodeData?.maxRawPoints} điểm thô
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6 max-h-[750px] overflow-y-auto pr-2">
                {currentCodeData?.questions.map((q) => {
                  const isMatching = !q.sourceAnswer || !q.correctAnswer || q.sourceAnswer === q.correctAnswer;
                  const isStemEditing = editingStemQId === q.id;

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
                    >
                      {/* Question top bar */}
                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            Câu {q.number}:
                          </span>
                          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                            {q.type === 'part1'
                              ? 'Phần I (Trắc nghiệm)'
                              : q.type === 'part2'
                              ? 'Phần II (Đúng/Sai)'
                              : 'Phần III (Trả lời ngắn)'}
                          </span>

                          {/* Matching indicator */}
                          {isMatching ? (
                            <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5 ml-2" title="Đáp án khớp chuẩn">
                              ✓ Khớp
                            </span>
                          ) : (
                            <span className="text-rose-600 text-xs font-semibold flex items-center gap-0.5 ml-2" title="Khác biệt giữa mã QR và file đề">
                              ⚠️ Không khớp (QR: {q.correctAnswer} / Đề: {q.sourceAnswer})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingStem(q)}
                            className="p-1 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Sửa nội dung câu hỏi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(selectedCode, q.id, q.number)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Xóa câu này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 7.1 Stem content or stem editor */}
                      {isStemEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={tempStemText}
                            onChange={(e) => setTempStemText(e.target.value)}
                            rows={3}
                            className="w-full text-xs p-2 border border-blue-400 rounded-lg focus:outline-none"
                            placeholder="Nhập nội dung đề bài (hỗ trợ công thức $...$)"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveEditingStem(selectedCode, q.id)}
                              className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded font-medium flex items-center gap-1 hover:bg-emerald-700"
                            >
                              <Check className="w-3 h-3" /> 💾 Lưu nội dung
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingStem}
                              className="px-2.5 py-1 text-xs bg-slate-200 text-slate-700 rounded font-medium hover:bg-slate-300"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-800">
                          <MathRenderer content={q.stem} />
                        </div>
                      )}

                      {/* 7.6 Image adjustment & display if question has image */}
                      {q.image && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                          {/* Image controls on a single row */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-medium">Vị trí:</span>
                              <select
                                value={q.image.position}
                                onChange={(e) =>
                                  updateImageSettings(selectedCode, q.id, {
                                    position: e.target.value as any,
                                  })
                                }
                                className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                              >
                                <option value="before_stem">Trên đề bài</option>
                                <option value="after_stem">Dưới đề bài</option>
                                <option value="after_options">Dưới phương án</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-medium">Căn chỉnh:</span>
                              <select
                                value={q.image.align}
                                onChange={(e) =>
                                  updateImageSettings(selectedCode, q.id, {
                                    align: e.target.value as any,
                                  })
                                }
                                className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                              >
                                <option value="left">Căn trái</option>
                                <option value="center">Căn giữa</option>
                                <option value="right">Căn phải</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-slate-500 font-medium">Kích thước: {q.image.width}px</span>
                              <input
                                type="range"
                                min="80"
                                max="900"
                                value={q.image.width}
                                onChange={(e) =>
                                  updateImageSettings(selectedCode, q.id, {
                                    width: parseInt(e.target.value),
                                  })
                                }
                                className="w-24 accent-blue-600"
                              />
                            </div>
                          </div>

                          {/* Image rendering */}
                          <div
                            className={`flex ${
                              q.image.align === 'center'
                                ? 'justify-center'
                                : q.image.align === 'right'
                                ? 'justify-end'
                                : 'justify-start'
                            }`}
                          >
                            <img
                              src={q.image.dataUrl}
                              alt={`Hình câu ${q.number}`}
                              style={{ width: `${q.image.width}px`, maxWidth: '100%' }}
                              className="rounded border border-slate-200"
                            />
                          </div>
                        </div>
                      )}

                      {/* 7.2 Part I Options editing */}
                      {q.type === 'part1' && q.options && (
                        <div className="space-y-1.5 pt-1">
                          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                            const isCorrect = q.correctAnswer === letter;
                            return (
                              <div
                                key={letter}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs ${
                                  isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50/60 border-slate-200'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`correct_p1_${q.id}`}
                                  checked={isCorrect}
                                  onChange={() =>
                                    updateQuestionAnswer(selectedCode, q.id, {
                                      correctAnswer: letter,
                                    })
                                  }
                                  className="text-emerald-600 focus:ring-emerald-500"
                                  title="Chọn đáp án đúng"
                                />
                                <span className="font-bold text-slate-700 w-4">{letter}.</span>
                                <input
                                  type="text"
                                  value={q.options?.[letter] || ''}
                                  onChange={(e) => {
                                    const nextOpts = { ...q.options, [letter]: e.target.value };
                                    updateQuestionAnswer(selectedCode, q.id, { options: nextOpts as any });
                                  }}
                                  className="w-full bg-white px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 7.3 Part II Statements editing */}
                      {q.type === 'part2' && q.statements && (
                        <div className="space-y-2 pt-1">
                          {q.statements.map((stmt) => {
                            const currentTF = q.correctAnswers?.[stmt.key] || 'Đ';
                            return (
                              <div
                                key={stmt.key}
                                className="flex items-start gap-2 text-xs bg-slate-50/70 p-2 rounded-lg border border-slate-200"
                              >
                                <span className="font-bold text-slate-700 mt-1">{stmt.key})</span>

                                {/* 2-line textarea max 430px */}
                                <textarea
                                  value={stmt.text}
                                  rows={2}
                                  style={{ maxWidth: '430px' }}
                                  onChange={(e) => {
                                    const nextStmts = q.statements?.map((s) =>
                                      s.key === stmt.key ? { ...s, text: e.target.value } : s
                                    );
                                    updateQuestionAnswer(selectedCode, q.id, { statements: nextStmts });
                                  }}
                                  className="w-full bg-white px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                                />

                                {/* Narrowed Đ/S select ~46px */}
                                <select
                                  value={currentTF}
                                  onChange={(e) => {
                                    const val = e.target.value as 'Đ' | 'S';
                                    const nextAnswers = { ...q.correctAnswers, [stmt.key]: val } as any;
                                    updateQuestionAnswer(selectedCode, q.id, { correctAnswers: nextAnswers });
                                  }}
                                  style={{ width: '46px' }}
                                  className={`px-1 py-1 rounded border text-center font-bold text-xs focus:outline-none ${
                                    currentTF === 'Đ'
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                      : 'bg-rose-100 border-rose-400 text-rose-800'
                                  }`}
                                >
                                  <option value="Đ">Đ</option>
                                  <option value="S">S</option>
                                </select>

                                {/* Lock / unlock toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStmts = q.statements?.map((s) =>
                                      s.key === stmt.key ? { ...s, locked: !s.locked } : s
                                    );
                                    updateQuestionAnswer(selectedCode, q.id, { statements: nextStmts });
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors mt-0.5"
                                  title={stmt.locked ? 'Đang khóa vị trí khi trộn' : 'Đang mở (được đảo)'}
                                >
                                  {stmt.locked ? (
                                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  ) : (
                                    <Unlock className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 7.4 Part III Short answer editing */}
                      {q.type === 'part3' && (
                        <div className="flex items-center gap-2 pt-1 text-xs">
                          <span className="font-semibold text-slate-700">Đáp án số:</span>
                          <input
                            type="text"
                            value={q.correctAnswer || ''}
                            onChange={(e) =>
                              updateQuestionAnswer(selectedCode, q.id, {
                                correctAnswer: e.target.value,
                              })
                            }
                            className="w-36 bg-white px-2 py-1 border border-slate-300 rounded font-mono font-bold text-emerald-700 focus:outline-none focus:border-blue-500"
                            placeholder="Ví dụ: 10 hoặc 3,9"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          4.5 LINK BÀI THI (toàn chiều rộng)
         ========================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          LINK BÀI THI
        </h2>

        {savedExamId ? (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 w-full md:w-auto">
              <div className="text-xs text-emerald-800 font-medium">
                Đường link bài thi duy nhất của đợt thi:
              </div>
              <a
                href={`/thi/${savedExamId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-blue-600 hover:underline break-all"
              >
                {examLink}
              </a>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess ? 'Đã sao chép!' : '📋 Sao chép link'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenExamForStudent(savedExamId, selectedCode)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>➡️ Mở link thi (sang vai học sinh)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs flex items-center justify-between">
            <span>Chưa có đợt thi nào được lưu. Vui lòng tải đề, mã QR và bấm "💾 LƯU TẤT CẢ CÁC ĐỀ" để sinh link thi.</span>
            <button
              type="button"
              onClick={() => {
                alert('Chưa có đề thi nào được lưu. Bạn cần tải đề và bấm "LƯU TẤT CẢ CÁC ĐỀ" trước khi mở link thi.');
              }}
              className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded text-xs font-medium cursor-not-allowed"
            >
              ➡️ Mở link thi (sang vai học sinh)
            </button>
          </div>
        )}
      </div>

      {/* =========================================
          4.6 BẢNG KẾT QUẢ (toàn chiều rộng)
         ========================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              BẢNG KẾT QUẢ
            </h2>
            <p className="text-xs text-slate-500">
              Cập nhật theo thời gian thực — Tổng số thí sinh: {submissions.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => exportSubmissionsToExcel(submissions, examInfo.examTitle)}
              disabled={submissions.length === 0}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                submissions.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>📊 Xuất file Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!savedExamId) return;
                setLoadingSubmissions(true);
                try {
                  const res = await fetch(`/api/exams/${savedExamId}/submissions`);
                  const data = await res.json();
                  setSubmissions(data.submissions || []);
                } finally {
                  setLoadingSubmissions(false);
                }
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSubmissions ? 'animate-spin' : ''}`} />
              <span>🔄 Làm mới bảng</span>
            </button>

            <button
              type="button"
              onClick={handleClearSubmissions}
              disabled={submissions.length === 0}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>🗑 Xóa tất cả kết quả (test)</span>
            </button>
          </div>
        </div>

        {/* Filter and search bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo họ tên, SBD, lớp..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Mã đề:</span>
            <select
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">Tất cả mã đề</option>
              {Object.keys(codesData).map((c) => (
                <option key={c} value={c}>
                  Mã {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Sắp xếp:</span>
            <select
              value={sortByScore}
              onChange={(e) => setSortByScore(e.target.value as any)}
              className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="desc">Điểm từ cao đến thấp</option>
              <option value="asc">Điểm từ thấp đến cao</option>
              <option value="none">Theo thời gian nộp</option>
            </select>
          </div>
        </div>

        {/* Submissions Table with all 16 separate columns */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-center">STT</th>
                <th className="px-3 py-3">Họ và tên</th>
                <th className="px-3 py-3">Trường</th>
                <th className="px-3 py-3">Lớp</th>
                <th className="px-3 py-3">Năm học</th>
                <th className="px-3 py-3">Số báo danh</th>
                <th className="px-3 py-3 text-center">Mã đề</th>
                <th className="px-3 py-3">Phòng thi</th>
                <th className="px-3 py-3 text-center font-extrabold text-red-600">Điểm thang 10</th>
                <th className="px-3 py-3 text-center">Điểm thô</th>
                <th className="px-3 py-3 text-center">Điểm tối đa</th>
                <th className="px-3 py-3 text-center">Phần I</th>
                <th className="px-3 py-3 text-center">Phần II</th>
                <th className="px-3 py-3 text-center">Phần III</th>
                <th className="px-3 py-3 text-center">Vi phạm rời màn hình</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Thời gian nộp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-8 text-center text-slate-400">
                    Chưa có bài thi nào được nộp.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const isViolation = sub.violationCount > 0;
                  const isExpelled = sub.status.includes('Vi phạm');

                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isExpelled ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{sub.studentInfo.fullName}</td>
                      <td className="px-3 py-2.5 text-slate-600">{sub.studentInfo.school}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{sub.studentInfo.className}</td>
                      <td className="px-3 py-2.5 text-slate-600">{sub.studentInfo.schoolYear}</td>
                      <td className="px-3 py-2.5 font-mono font-medium text-blue-700">{sub.studentInfo.studentId}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-900">{sub.studentInfo.examCode}</td>
                      <td className="px-3 py-2.5 text-slate-600">{sub.studentInfo.room}</td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-red-600 text-sm">
                        {sub.score10.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-700 font-medium">{sub.rawScore}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{sub.maxRawScore}</td>
                      <td className="px-3 py-2.5 text-center text-slate-700">{sub.scorePart1}</td>
                      <td className="px-3 py-2.5 text-center text-slate-700">{sub.scorePart2}</td>
                      <td className="px-3 py-2.5 text-center text-slate-700">{sub.scorePart3}</td>
                      <td className="px-3 py-2.5 text-center">
                        {isViolation ? (
                          <span className="font-bold text-rose-600">
                            {sub.violationCount} lần
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-semibold ${
                            isExpelled ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-[11px]">
                        {new Date(sub.submittedAt).toLocaleTimeString('vi-VN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
