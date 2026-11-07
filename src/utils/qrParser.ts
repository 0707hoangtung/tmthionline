import {
  ParsedQRAnswers,
  CrossCheckResult,
  CrossCheckMismatch,
  ExamCodeData,
} from '../types';

export interface QRDataFormat {
  success: boolean;
  type: number;
  [code: string]: any;
}

/**
 * Normalizes Vietnamese True/False character:
 * Accepts 'Đ', 'đ', 'D', 'd' -> 'Đ'
 * Accepts 'S', 's' -> 'S'
 */
export function normalizeTFChar(char: string): 'Đ' | 'S' {
  const c = char.trim().toUpperCase();
  if (c === 'Đ' || c === 'D' || c === 'T' || c === 'TRUE') {
    return 'Đ';
  }
  return 'S';
}

/**
 * Parses raw QR JSON string into structured ParsedQRAnswers
 */
export function parseQRString(qrString: string): {
  success: boolean;
  data?: ParsedQRAnswers;
  error?: string;
  rawJson?: QRDataFormat;
} {
  try {
    let cleanStr = qrString.trim();
    // In case there is surrounding whitespace or quotes
    const parsed: QRDataFormat = JSON.parse(cleanStr);

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Dữ liệu mã QR không phải là đối tượng JSON hợp lệ.' };
    }

    // Notice prompt says: type: 5
    if (parsed.type !== undefined && parsed.type !== 5) {
      // Still accept or warn, but according to section 5: "type: 5 (luôn là 5 — chấp nhận giá trị này khi đọc mã QR vào)"
    }

    const result: ParsedQRAnswers = {};
    const keys = Object.keys(parsed).filter((k) => k !== 'success' && k !== 'type');

    if (keys.length === 0) {
      return { success: false, error: 'Mã QR không chứa bất kỳ mã đề nào.' };
    }

    for (const code of keys) {
      const codeVal = String(parsed[code] || '').trim();
      const parts = codeVal.split('#');

      if (parts.length < 3) {
        return {
          success: false,
          error: `Mã đề ${code} trong mã QR không đủ 3 phần (Phần I#Phần II#Phần III). Giá trị: "${codeVal}"`,
        };
      }

      const rawPart1 = parts[0].trim();
      const rawPart2 = parts[1].trim();
      const rawPart3 = parts.slice(2).join('#').trim(); // in case Part 3 has hashes, though usually none

      // Part 1: letters e.g. "ACBCABADACDD"
      const part1Answers: string[] = [];
      for (let i = 0; i < rawPart1.length; i++) {
        const char = rawPart1[i].toUpperCase();
        if (/[A-D]/.test(char)) {
          part1Answers.push(char);
        }
      }

      // Part 2: groups of 4 letters Đ/S separated by '_' e.g. "SĐĐS_ĐSSĐ"
      const part2Groups = rawPart2 ? rawPart2.split('_').filter(Boolean) : [];
      const part2Answers: Array<{ a: 'Đ' | 'S'; b: 'Đ' | 'S'; c: 'Đ' | 'S'; d: 'Đ' | 'S' }> = [];

      for (const group of part2Groups) {
        const letters = group.split('');
        if (letters.length !== 4) {
          return {
            success: false,
            error: `Mã đề ${code}: Nhóm Đúng/Sai "${group}" trong mã QR không đủ 4 ý (a, b, c, d).`,
          };
        }
        part2Answers.push({
          a: normalizeTFChar(letters[0]),
          b: normalizeTFChar(letters[1]),
          c: normalizeTFChar(letters[2]),
          d: normalizeTFChar(letters[3]),
        });
      }

      // Part 3: answers separated by '_' e.g. "10_4_3_23" or "3,9_12"
      const part3Answers = rawPart3 ? rawPart3.split('_').map((s) => s.trim()).filter((s) => s.length > 0) : [];

      result[code] = {
        part1: part1Answers,
        part2: part2Answers,
        part3: part3Answers,
        rawPart1,
        rawPart2,
        rawPart3,
      };
    }

    return { success: true, data: result, rawJson: parsed };
  } catch (err: any) {
    return {
      success: false,
      error: `Lỗi đọc chuỗi JSON mã QR: ${err.message || 'Cú pháp JSON không hợp lệ'}.`,
    };
  }
}

/**
 * 2-Layer Cross Check:
 * (a) Quantity check
 * (b) Letter-by-letter check with source answers from exam
 */
export function performCrossCheck(
  codesData: Record<string, ExamCodeData>,
  parsedQR: ParsedQRAnswers
): CrossCheckResult {
  const errors: string[] = [];
  const mismatches: CrossCheckMismatch[] = [];
  const examCodes = Object.keys(codesData);
  const qrCodes = Object.keys(parsedQR);

  // Check code existence
  for (const code of examCodes) {
    if (!parsedQR[code]) {
      errors.push(`Mã đề ${code} có trong file đề thi nhưng KHÔNG TÌM THẤY trong mã QR đáp án.`);
    }
  }

  for (const code of qrCodes) {
    if (!codesData[code]) {
      errors.push(`Mã đề ${code} có trong mã QR đáp án nhưng KHÔNG CÓ trong danh sách đề thi đã tải lên.`);
    }
  }

  // Cross check for each matching code
  for (const code of examCodes) {
    const qr = parsedQR[code];
    if (!qr) continue;

    const exam = codesData[code];
    const part1Questions = exam.questions.filter((q) => q.type === 'part1');
    const part2Questions = exam.questions.filter((q) => q.type === 'part2');
    const part3Questions = exam.questions.filter((q) => q.type === 'part3');

    // (a) Quantity check
    // Part I
    if (qr.part1.length !== part1Questions.length) {
      const diff = qr.part1.length - part1Questions.length;
      errors.push(
        `Mã đề ${code} - Phần I: Đề thi có ${part1Questions.length} câu nhưng mã QR có ${qr.part1.length} đáp án (${diff > 0 ? `thừa ${diff}` : `thiếu ${Math.abs(diff)}`} đáp án).`
      );
    }

    // Part II
    if (qr.part2.length !== part2Questions.length) {
      const diff = qr.part2.length - part2Questions.length;
      errors.push(
        `Mã đề ${code} - Phần II: Đề thi có ${part2Questions.length} câu Đúng/Sai nhưng mã QR có ${qr.part2.length} nhóm (${diff > 0 ? `thừa ${diff}` : `thiếu ${Math.abs(diff)}`} nhóm).`
      );
    }

    // Part III
    if (qr.part3.length !== part3Questions.length) {
      const diff = qr.part3.length - part3Questions.length;
      errors.push(
        `Mã đề ${code} - Phần III: Đề thi có ${part3Questions.length} câu trả lời ngắn nhưng mã QR có ${qr.part3.length} đáp án (${diff > 0 ? `thừa ${diff}` : `thiếu ${Math.abs(diff)}`} đáp án).`
      );
    }

    // (b) Letter-by-letter check (when exam questions have sourceAnswer)
    // Check Part I
    const p1Limit = Math.min(part1Questions.length, qr.part1.length);
    for (let i = 0; i < p1Limit; i++) {
      const q = part1Questions[i];
      const qrAns = qr.part1[i];
      const fileAns = q.sourceAnswer || q.correctAnswer;

      if (fileAns && fileAns.trim().toUpperCase() !== qrAns.trim().toUpperCase()) {
        const mismatch: CrossCheckMismatch = {
          code,
          part: 'Phần I',
          questionNumber: q.number,
          qrValue: qrAns,
          fileValue: fileAns,
          message: `Mã đề ${code} - Phần I Câu ${q.number}: Mã QR ghi đáp án "${qrAns}", trong khi file đề ghi "${fileAns}".`,
        };
        mismatches.push(mismatch);
        errors.push(mismatch.message);
      }
    }

    // Check Part II
    const p2Limit = Math.min(part2Questions.length, qr.part2.length);
    for (let i = 0; i < p2Limit; i++) {
      const q = part2Questions[i];
      const qrGroup = qr.part2[i];
      const fileGroup = q.sourceAnswersPart2 || q.correctAnswers;

      if (fileGroup) {
        const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
        for (const k of keys) {
          const qrVal = qrGroup[k];
          const fileVal = fileGroup[k];
          if (fileVal && fileVal !== qrVal) {
            const mismatch: CrossCheckMismatch = {
              code,
              part: 'Phần II',
              questionNumber: q.number,
              itemKey: k,
              qrValue: qrVal,
              fileValue: fileVal,
              message: `Mã đề ${code} - Phần II Câu ${q.number} ý ${k}): Mã QR ghi "${qrVal}", file đề ghi "${fileVal}".`,
            };
            mismatches.push(mismatch);
            errors.push(mismatch.message);
          }
        }
      }
    }

    // Check Part III
    const p3Limit = Math.min(part3Questions.length, qr.part3.length);
    for (let i = 0; i < p3Limit; i++) {
      const q = part3Questions[i];
      const qrAns = qr.part3[i];
      const fileAns = q.sourceAnswer || q.correctAnswer;

      if (fileAns) {
        // Compare values (handling 3.9 vs 3,9)
        const normQr = qrAns.replace(',', '.').trim();
        const normFile = fileAns.replace(',', '.').trim();
        if (normQr !== normFile) {
          const mismatch: CrossCheckMismatch = {
            code,
            part: 'Phần III',
            questionNumber: q.number,
            qrValue: qrAns,
            fileValue: fileAns,
            message: `Mã đề ${code} - Phần III Câu ${q.number}: Mã QR ghi "${qrAns}", file đề ghi "${fileAns}".`,
          };
          mismatches.push(mismatch);
          errors.push(mismatch.message);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    mismatches,
    summary: {
      totalCodes: examCodes.length,
      codes: examCodes,
    },
  };
}

/**
 * Builds QR JSON string matching the exact format:
 * {"success":true,"type":5,"1011":"...","1012":"..."}
 */
export function buildQRStringFromCodes(codesData: Record<string, ExamCodeData>): string {
  const result: any = {
    success: true,
    type: 5,
  };

  for (const code of Object.keys(codesData)) {
    const exam = codesData[code];
    const p1 = exam.questions
      .filter((q) => q.type === 'part1')
      .map((q) => q.correctAnswer || 'A')
      .join('');

    const p2 = exam.questions
      .filter((q) => q.type === 'part2')
      .map((q) => {
        const ca = q.correctAnswers || { a: 'Đ', b: 'S', c: 'Đ', d: 'S' };
        return `${ca.a}${ca.b}${ca.c}${ca.d}`;
      })
      .join('_');

    const p3 = exam.questions
      .filter((q) => q.type === 'part3')
      .map((q) => q.correctAnswer || '0')
      .join('_');

    result[code] = `${p1}#${p2}#${p3}`;
  }

  return JSON.stringify(result);
}
