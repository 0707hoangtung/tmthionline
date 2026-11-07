import {
  Question,
  StudentAnswers,
  SubmissionGradingDetail,
  ExamInfo,
} from '../types';

/**
 * Normalizes number string:
 * Converts "3,9" to "3.9", removes leading/trailing spaces
 * Converts expressions like "sqrt(16)" or "4.0" to normalized form
 */
export function normalizeNumberAnswer(raw: string): string {
  if (!raw) return '';
  let str = raw.trim().replace(',', '.');

  // If answer contains sqrt(...) or simple math, evaluate if possible
  if (/^sqrt\(\s*(\d+(?:\.\d+)?)\s*\)$/i.test(str)) {
    const val = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (!isNaN(val)) {
      const sqrtVal = Math.sqrt(val);
      return String(Number(sqrtVal.toFixed(6)));
    }
  }

  // If it's a valid number, format cleanly without trailing .0 if integer
  const num = Number(str);
  if (!isNaN(num) && str !== '') {
    // Return standard string representation
    return String(num);
  }

  return str.toLowerCase();
}

/**
 * Calculates raw points for Part II question based on QĐ 764:
 * 0 correct statements -> 0 pt
 * 1 correct statement -> 0.1 pt
 * 2 correct statements -> 0.25 pt
 * 3 correct statements -> 0.5 pt
 * 4 correct statements -> 1.0 pt
 */
export function calculatePart2Score(correctCount: number): number {
  switch (correctCount) {
    case 4:
      return 1.0;
    case 3:
      return 0.5;
    case 2:
      return 0.25;
    case 1:
      return 0.1;
    default:
      return 0.0;
  }
}

export interface ScoreCalculationResult {
  rawScore: number;
  maxRawScore: number;
  score10: number;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  correctPart1Count: number;
  correctPart2ItemCount: number;
  correctPart3Count: number;
  totalPart1: number;
  totalPart2: number;
  totalPart3: number;
  details: SubmissionGradingDetail[];
}

/**
 * Server-side scoring implementation
 */
export function gradeStudentSubmission(
  questions: Question[],
  answers: StudentAnswers,
  info: ExamInfo
): ScoreCalculationResult {
  const part3PerQuestion = info.part3Points === 1.0 ? 1.0 : 0.5;

  let rawScore = 0;
  let maxRawScore = 0;
  let scorePart1 = 0;
  let scorePart2 = 0;
  let scorePart3 = 0;
  let correctPart1Count = 0;
  let correctPart2ItemCount = 0;
  let correctPart3Count = 0;

  let totalPart1 = 0;
  let totalPart2 = 0;
  let totalPart3 = 0;

  const details: SubmissionGradingDetail[] = [];

  for (const q of questions) {
    const ans = answers[q.id] || {};

    if (q.type === 'part1') {
      totalPart1++;
      maxRawScore += 0.25;
      const expected = (q.correctAnswer || '').trim().toUpperCase();
      const studentChoice = (ans.part1Choice || '').trim().toUpperCase();
      const isCorrect = studentChoice !== '' && studentChoice === expected;
      const qScore = isCorrect ? 0.25 : 0;

      if (isCorrect) {
        scorePart1 += 0.25;
        correctPart1Count++;
      }

      details.push({
        questionId: q.id,
        number: q.number,
        type: 'part1',
        isCorrect,
        score: qScore,
        maxScore: 0.25,
        studentAnswer: studentChoice,
        correctAnswer: expected,
      });
    } else if (q.type === 'part2') {
      totalPart2++;
      maxRawScore += 1.0;
      const expected = q.correctAnswers || { a: 'Đ', b: 'S', c: 'Đ', d: 'S' };
      const studentChoices = ans.part2Choices || {};

      let correctItems = 0;
      const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];

      for (const k of keys) {
        const studentK = studentChoices[k];
        const expectedK = expected[k];
        if (studentK && expectedK && studentK.toUpperCase() === expectedK.toUpperCase()) {
          correctItems++;
          correctPart2ItemCount++;
        }
      }

      const qScore = calculatePart2Score(correctItems);
      scorePart2 += qScore;

      details.push({
        questionId: q.id,
        number: q.number,
        type: 'part2',
        isCorrect: correctItems === 4,
        score: qScore,
        maxScore: 1.0,
        part2CorrectCount: correctItems,
        studentAnswer: studentChoices,
        correctAnswer: expected,
      });
    } else if (q.type === 'part3') {
      totalPart3++;
      maxRawScore += part3PerQuestion;

      const expectedRaw = (q.correctAnswer || '').trim();
      const studentRaw = (ans.part3Value || '').trim();

      const normExpected = normalizeNumberAnswer(expectedRaw);
      const normStudent = normalizeNumberAnswer(studentRaw);

      const isCorrect = normStudent !== '' && normStudent === normExpected;
      const qScore = isCorrect ? part3PerQuestion : 0;

      if (isCorrect) {
        scorePart3 += part3PerQuestion;
        correctPart3Count++;
      }

      details.push({
        questionId: q.id,
        number: q.number,
        type: 'part3',
        isCorrect,
        score: qScore,
        maxScore: part3PerQuestion,
        studentAnswer: studentRaw,
        correctAnswer: expectedRaw,
      });
    }
  }

  rawScore = Number((scorePart1 + scorePart2 + scorePart3).toFixed(3));
  maxRawScore = Number(maxRawScore.toFixed(3));

  // 10-point scale: (rawScore / maxRawScore) * 10, rounded to 1 decimal place
  let score10 = 0;
  if (maxRawScore > 0) {
    score10 = Math.round((rawScore / maxRawScore) * 100) / 10;
  }

  return {
    rawScore,
    maxRawScore,
    score10,
    scorePart1: Number(scorePart1.toFixed(3)),
    scorePart2: Number(scorePart2.toFixed(3)),
    scorePart3: Number(scorePart3.toFixed(3)),
    correctPart1Count,
    correctPart2ItemCount,
    correctPart3Count,
    totalPart1,
    totalPart2,
    totalPart3,
    details,
  };
}
