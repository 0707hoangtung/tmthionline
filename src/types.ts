export interface ExamInfo {
  department: string; // Sở GD-ĐT (e.g. SỞ GD-ĐT THANH HOÁ)
  school: string; // Trường (e.g. TRƯỜNG THPT TỈNH GIA 4)
  examTitle: string; // Tên bài kiểm tra (e.g. KIỂM TRA GIỮA KỲ I LỚP 12)
  schoolYear: string; // Năm học (e.g. 2026-2027)
  subject: string; // Môn học (e.g. Toán)
  duration: number; // Thời gian (phút, 1-180)
  part3Points: 0.5 | 1.0; // Điểm mỗi câu Phần III (mặc định 0.5)
}

export type QuestionType = 'part1' | 'part2' | 'part3';

export interface QuestionImage {
  dataUrl: string;
  position: 'before_stem' | 'after_stem' | 'after_options';
  align: 'left' | 'center' | 'right';
  width: number; // 80 to 900 px
}

export interface StatementItem {
  key: 'a' | 'b' | 'c' | 'd';
  text: string;
  locked?: boolean;
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;
  stem: string;
  image?: QuestionImage;
  // Part 1:
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer?: string; // Part 1: 'A'|'B'|'C'|'D'; Part 3: string (e.g. "10", "3.9")
  // Part 2:
  statements?: StatementItem[];
  correctAnswers?: {
    a: 'Đ' | 'S';
    b: 'Đ' | 'S';
    c: 'Đ' | 'S';
    d: 'Đ' | 'S';
  };
  // Answer from original file (for cross-checking with QR)
  sourceAnswer?: string;
  sourceAnswersPart2?: {
    a: 'Đ' | 'S';
    b: 'Đ' | 'S';
    c: 'Đ' | 'S';
    d: 'Đ' | 'S';
  };
}

export interface ExamCodeData {
  code: string; // e.g. "1011"
  questions: Question[];
  part1Count: number;
  part2Count: number;
  part3Count: number;
  maxRawPoints: number;
}

export interface ParsedQRAnswers {
  [code: string]: {
    part1: string[]; // ['A', 'C', ...]
    part2: Array<{ a: 'Đ' | 'S'; b: 'Đ' | 'S'; c: 'Đ' | 'S'; d: 'Đ' | 'S' }>;
    part3: string[]; // ['10', '4', '3,9', ...]
    rawPart1: string;
    rawPart2: string;
    rawPart3: string;
  };
}

export interface CrossCheckMismatch {
  code: string;
  part: string;
  questionNumber: number;
  itemKey?: string;
  qrValue: string;
  fileValue: string;
  message: string;
}

export interface CrossCheckResult {
  valid: boolean;
  errors: string[];
  mismatches: CrossCheckMismatch[];
  summary: {
    totalCodes: number;
    codes: string[];
  };
}

export interface ExamRecord {
  id: string; // unique examId
  title: string;
  createdAt: string;
  info: ExamInfo;
  codes: Record<string, ExamCodeData>;
  qrJsonRaw?: string;
  parsedQR?: ParsedQRAnswers;
}

export interface StudentInfo {
  fullName: string; // Họ và tên
  school: string; // Trường
  className: string; // Lớp
  schoolYear: string; // Năm học
  studentId: string; // Số báo danh
  examCode: string; // Mã đề
  room: string; // Phòng thi
}

export interface StudentAnswers {
  [questionId: string]: {
    part1Choice?: 'A' | 'B' | 'C' | 'D';
    part2Choices?: {
      a?: 'Đ' | 'S';
      b?: 'Đ' | 'S';
      c?: 'Đ' | 'S';
      d?: 'Đ' | 'S';
    };
    part3Value?: string;
  };
}

export interface SubmissionGradingDetail {
  questionId: string;
  number: number;
  type: QuestionType;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  part2CorrectCount?: number;
  studentAnswer: any;
  correctAnswer?: any; // Only returned after submission
}

export interface StudentSubmission {
  id: string;
  examId: string;
  studentInfo: StudentInfo;
  submittedAt: string;
  status: 'Đã nộp' | 'Vi phạm quy chế — bị đưa ra khỏi phòng thi';
  violationCount: number;
  rawScore: number;
  maxRawScore: number;
  score10: number; // ĐIỂM THANG 10
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  correctPart1Count: number;
  correctPart2ItemCount: number;
  correctPart3Count: number;
  totalPart1: number;
  totalPart2: number;
  totalPart3: number;
  answers: StudentAnswers;
  details?: SubmissionGradingDetail[];
}
