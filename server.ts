import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  ExamRecord,
  StudentSubmission,
  StudentInfo,
  StudentAnswers,
  ExamCodeData,
} from './src/types';
import { gradeStudentSubmission } from './src/utils/scoring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'exams_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  exams: Record<string, ExamRecord>;
  submissions: Record<string, StudentSubmission[]>;
}

// In-memory cache synced with disk
let db: DatabaseSchema = {
  exams: {},
  submissions: {},
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
    }
  } catch (err) {
    console.error('Lỗi khi đọc file cơ sở dữ liệu:', err);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi ghi cơ sở dữ liệu:', err);
  }
}

loadDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ========================
  // API ROUTES
  // ========================

  // 1. Save or update exam (Teacher)
  app.post('/api/exams', (req, res) => {
    try {
      const { id, info, codes, qrJsonRaw, parsedQR } = req.body;

      if (!codes || Object.keys(codes).length === 0) {
        return res.status(400).json({ error: 'Đề thi không có dữ liệu mã đề nào.' });
      }

      const examId = id || `ex_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const title = info?.examTitle || 'Đợt thi mới';

      const examRecord: ExamRecord = {
        id: examId,
        title,
        createdAt: new Date().toISOString(),
        info,
        codes,
        qrJsonRaw,
        parsedQR,
      };

      db.exams[examId] = examRecord;
      if (!db.submissions[examId]) {
        db.submissions[examId] = [];
      }
      saveDatabase();

      return res.json({
        success: true,
        examId,
        message: 'Lưu đợt thi thành công.',
      });
    } catch (err: any) {
      console.error('Error saving exam:', err);
      return res.status(500).json({ error: err.message || 'Lỗi server khi lưu đề thi.' });
    }
  });

  // 2. Get all exams list (Teacher)
  app.get('/api/exams', (req, res) => {
    const list = Object.values(db.exams).map((e) => ({
      id: e.id,
      title: e.title,
      createdAt: e.createdAt,
      info: e.info,
      codesList: Object.keys(e.codes),
      submissionsCount: (db.submissions[e.id] || []).length,
    }));
    return res.json({ exams: list });
  });

  // 3. Get single exam full data (Teacher view with answers)
  app.get('/api/exams/:id', (req, res) => {
    const exam = db.exams[req.params.id];
    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy đợt thi này.' });
    }
    return res.json({ exam });
  });

  // 4. Get sanitized exam for Student (NO ANSWERS - STRICT SECURITY)
  app.get('/api/exams/:id/student-view', (req, res) => {
    const exam = db.exams[req.params.id];
    if (!exam) {
      return res.status(404).json({ error: 'Đợt thi không tồn tại hoặc đã bị xóa.' });
    }

    const requestedCode = (req.query.code as string) || '';
    const availableCodes = Object.keys(exam.codes);

    // If student requested a code, verify it exists
    let codeData: ExamCodeData | null = null;
    if (requestedCode && exam.codes[requestedCode]) {
      const originalCodeData = exam.codes[requestedCode];

      // Sanitize questions: strip all answers
      const sanitizedQuestions = originalCodeData.questions.map((q) => {
        return {
          id: q.id,
          number: q.number,
          type: q.type,
          stem: q.stem,
          image: q.image,
          options: q.options,
          statements: q.statements?.map((s) => ({
            key: s.key,
            text: s.text,
            locked: s.locked,
          })),
          // DO NOT INCLUDE correctAnswer, correctAnswers, sourceAnswer, sourceAnswersPart2
        };
      });

      codeData = {
        code: originalCodeData.code,
        questions: sanitizedQuestions as any,
        part1Count: originalCodeData.part1Count,
        part2Count: originalCodeData.part2Count,
        part3Count: originalCodeData.part3Count,
        maxRawPoints: originalCodeData.maxRawPoints,
      };
    }

    return res.json({
      examId: exam.id,
      title: exam.title,
      info: exam.info,
      availableCodes,
      selectedCodeData: codeData,
    });
  });

  // 5. Submit exam by student (SERVER-SIDE SCORING)
  app.post('/api/exams/:id/submit', (req, res) => {
    try {
      const exam = db.exams[req.params.id];
      if (!exam) {
        return res.status(404).json({ error: 'Đợt thi không tồn tại.' });
      }

      const { studentInfo, answers, violationCount = 0, isExpelled = false } = req.body;

      if (!studentInfo || !studentInfo.examCode) {
        return res.status(400).json({ error: 'Thiếu thông tin thí sinh hoặc mã đề.' });
      }

      const code = studentInfo.examCode;
      const codeData = exam.codes[code];
      if (!codeData) {
        return res.status(400).json({ error: `Mã đề ${code} không tồn tại trong đợt thi này.` });
      }

      // Grade using server-stored answer key and QĐ 764
      const grade = gradeStudentSubmission(codeData.questions, answers || {}, exam.info);

      const status = isExpelled || violationCount >= 2
        ? 'Vi phạm quy chế — bị đưa ra khỏi phòng thi'
        : 'Đã nộp';

      const submission: StudentSubmission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        examId: exam.id,
        studentInfo: {
          fullName: studentInfo.fullName || '',
          school: studentInfo.school || '',
          className: studentInfo.className || '',
          schoolYear: studentInfo.schoolYear || '',
          studentId: studentInfo.studentId || '',
          examCode: code,
          room: studentInfo.room || '',
        },
        submittedAt: new Date().toISOString(),
        status,
        violationCount,
        rawScore: grade.rawScore,
        maxRawScore: grade.maxRawScore,
        score10: grade.score10,
        scorePart1: grade.scorePart1,
        scorePart2: grade.scorePart2,
        scorePart3: grade.scorePart3,
        correctPart1Count: grade.correctPart1Count,
        correctPart2ItemCount: grade.correctPart2ItemCount,
        correctPart3Count: grade.correctPart3Count,
        totalPart1: grade.totalPart1,
        totalPart2: grade.totalPart2,
        totalPart3: grade.totalPart3,
        answers: answers || {},
        details: grade.details,
      };

      if (!db.submissions[exam.id]) {
        db.submissions[exam.id] = [];
      }
      db.submissions[exam.id].unshift(submission);
      saveDatabase();

      return res.json({
        success: true,
        submission,
      });
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      return res.status(500).json({ error: err.message || 'Lỗi server khi chấm điểm bài thi.' });
    }
  });

  // 6. Real-time submissions table for teacher
  app.get('/api/exams/:id/submissions', (req, res) => {
    const list = db.submissions[req.params.id] || [];
    return res.json({ submissions: list });
  });

  // 7. Clear all test results (Teacher)
  app.delete('/api/exams/:id/submissions', (req, res) => {
    db.submissions[req.params.id] = [];
    saveDatabase();
    return res.json({ success: true, message: 'Đã xóa tất cả kết quả thi thành công.' });
  });

  // 8. Delete exam (Teacher)
  app.delete('/api/exams/:id', (req, res) => {
    delete db.exams[req.params.id];
    delete db.submissions[req.params.id];
    saveDatabase();
    return res.json({ success: true, message: 'Đã xóa đợt thi.' });
  });

  // Mount Vite or static build
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
