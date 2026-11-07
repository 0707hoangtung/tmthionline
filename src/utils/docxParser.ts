import JSZip from 'jszip';
import { Question, ExamCodeData, QuestionType, StatementItem } from '../types';

export interface ParseDocxResult {
  success: boolean;
  codes: Record<string, ExamCodeData>;
  error?: string;
  hasMathTypeWarning?: boolean;
  mathTypeDetails?: string;
  detectedImagesCount: number;
}

/**
 * Extracts all relationships from word/_rels/document.xml.rels
 */
function extractRelationships(relsXml: string): Record<string, string> {
  const rels: Record<string, string> = {};
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(relsXml, 'text/xml');
  const relElements = xmlDoc.getElementsByTagName('Relationship');

  for (let i = 0; i < relElements.length; i++) {
    const el = relElements[i];
    const id = el.getAttribute('Id');
    const target = el.getAttribute('Target');
    if (id && target) {
      rels[id] = target;
    }
  }

  return rels;
}

/**
 * Converts OMML XML node (m:oMath or child) to LaTeX string
 */
function ommlToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as Element;
  const tagName = el.localName || el.nodeName.replace(/^.*:/, '');

  switch (tagName) {
    case 'oMath':
    case 'oMathPara': {
      let inner = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        inner += ommlToLatex(el.childNodes[i]);
      }
      return inner;
    }

    case 'f': {
      // Fraction: <m:num> and <m:den>
      let num = '';
      let den = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'num') {
          num = ommlToLatex(child);
        } else if (cName === 'den') {
          den = ommlToLatex(child);
        }
      }
      return `\\frac{${num}}{${den}}`;
    }

    case 'sSup': {
      // Superscript: <m:e> and <m:sup>
      let base = '';
      let sup = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'e') {
          base = ommlToLatex(child);
        } else if (cName === 'sup') {
          sup = ommlToLatex(child);
        }
      }
      return `{${base}}^{${sup}}`;
    }

    case 'sSub': {
      // Subscript: <m:e> and <m:sub>
      let base = '';
      let sub = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'e') {
          base = ommlToLatex(child);
        } else if (cName === 'sub') {
          sub = ommlToLatex(child);
        }
      }
      return `{${base}}_{${sub}}`;
    }

    case 'sSubSup': {
      // Subscript and Superscript: <m:e>, <m:sub>, <m:sup>
      let base = '';
      let sub = '';
      let sup = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'e') base = ommlToLatex(child);
        else if (cName === 'sub') sub = ommlToLatex(child);
        else if (cName === 'sup') sup = ommlToLatex(child);
      }
      return `{${base}}_{${sub}}^{${sup}}`;
    }

    case 'rad': {
      // Radical: <m:deg> and <m:e>
      let deg = '';
      let e = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'deg') deg = ommlToLatex(child);
        else if (cName === 'e') e = ommlToLatex(child);
      }
      if (deg && deg.trim()) {
        return `\\sqrt[${deg}]{${e}}`;
      }
      return `\\sqrt{${e}}`;
    }

    case 'd': {
      // Delimiter (parentheses, brackets, etc.)
      let content = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'e') {
          content = ommlToLatex(child);
        }
      }
      return `\\left(${content}\\right)`;
    }

    case 'limLow':
    case 'limUpp': {
      // Limits: \lim_{...}
      let base = '';
      let lim = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i] as Element;
        const cName = child.localName || child.nodeName.replace(/^.*:/, '');
        if (cName === 'e') base = ommlToLatex(child);
        else if (cName === 'lim') lim = ommlToLatex(child);
      }
      return `\\lim_{${lim}} ${base}`;
    }

    case 't': {
      // Text inside math
      let text = el.textContent || '';
      // Ensure < and > are preserved
      return text;
    }

    default: {
      let res = '';
      for (let i = 0; i < el.childNodes.length; i++) {
        res += ommlToLatex(el.childNodes[i]);
      }
      return res;
    }
  }
}

/**
 * Clean up LaTeX string (duplicate lim, spacing, etc.)
 */
function cleanLatex(latex: string): string {
  let cleaned = latex.trim();
  // Remove redundant "lim" immediately following \lim_{...} (bug from app 1)
  cleaned = cleaned.replace(/\\lim_\{([^}]+)\}\s*lim\b/g, '\\lim_{$1} ');
  return cleaned;
}

/**
 * Parses word/document.xml and extracts paragraphs, tables, images, and math
 */
export async function parseDocxFile(file: File): Promise<ParseDocxResult> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    const docXmlFile = contents.file('word/document.xml');
    if (!docXmlFile) {
      return {
        success: false,
        codes: {},
        error: 'File không phải định dạng Word .docx hợp lệ (thiếu word/document.xml).',
        detectedImagesCount: 0,
      };
    }

    const docXmlStr = await docXmlFile.async('text');

    // Check for MathType OLE objects
    const hasMathType = docXmlStr.includes('Equation.DSMT4') || docXmlStr.includes('MathType');

    // Extract relationships for media
    let rels: Record<string, string> = {};
    const relsFile = contents.file('word/_rels/document.xml.rels');
    if (relsFile) {
      const relsStr = await relsFile.async('text');
      rels = extractRelationships(relsStr);
    }

    // Extract media files (images) into Data URLs
    const mediaMap: Record<string, string> = {};
    let imageCount = 0;

    for (const rId of Object.keys(rels)) {
      const target = rels[rId];
      if (target.startsWith('media/') || target.startsWith('/word/media/') || target.includes('media/')) {
        const cleanPath = target.startsWith('/') ? target.substring(1) : `word/${target}`;
        const mediaFile = contents.file(cleanPath);
        if (mediaFile) {
          const ext = cleanPath.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
          const base64 = await mediaFile.async('base64');
          mediaMap[rId] = `data:${mimeType};base64,${base64}`;
          imageCount++;
        }
      }
    }

    // Parse document.xml using DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlStr, 'text/xml');
    const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.getElementsByTagName('body')[0];

    if (!body) {
      return {
        success: false,
        codes: {},
        error: 'Không tìm thấy nội dung w:body trong document.xml.',
        detectedImagesCount: 0,
      };
    }

    // Extract ordered items (paragraphs and tables)
    interface ParsedParagraph {
      text: string;
      images: string[];
      isTable?: boolean;
      tableHtml?: string;
    }

    const paragraphs: ParsedParagraph[] = [];

    for (let i = 0; i < body.childNodes.length; i++) {
      const child = body.childNodes[i] as Element;
      if (!child || child.nodeType !== Node.ELEMENT_NODE) continue;

      const nodeName = child.localName || child.nodeName.replace(/^.*:/, '');

      if (nodeName === 'p') {
        let pText = '';
        const pImages: string[] = [];

        // Traverse child nodes of paragraph
        const walkNode = (n: Node) => {
          if (n.nodeType === Node.TEXT_NODE) {
            pText += n.textContent || '';
            return;
          }
          if (n.nodeType !== Node.ELEMENT_NODE) return;

          const el = n as Element;
          const name = el.localName || el.nodeName.replace(/^.*:/, '');

          if (name === 'oMath' || name === 'oMathPara') {
            // Render as inline or block math
            const latex = cleanLatex(ommlToLatex(el));
            if (latex) {
              pText += ` $${latex}$ `;
            }
            return; // don't recurse inside oMath
          }

          if (name === 'blip') {
            const embed = el.getAttribute('r:embed') || el.getAttribute('embed');
            if (embed && mediaMap[embed]) {
              pImages.push(mediaMap[embed]);
              pText += ' [hình] ';
            }
          }

          if (name === 't') {
            pText += el.textContent || '';
            return;
          }

          for (let j = 0; j < el.childNodes.length; j++) {
            walkNode(el.childNodes[j]);
          }
        };

        walkNode(child);
        const trimmed = pText.trim();
        if (trimmed || pImages.length > 0) {
          paragraphs.push({
            text: trimmed,
            images: pImages,
          });
        }
      } else if (nodeName === 'tbl') {
        // Table (e.g. variation table / bảng biến thiên)
        let tblText = '';
        const tblImages: string[] = [];
        let tableHtml = '<table class="border border-slate-300 border-collapse my-2 text-sm">';

        const rows = child.getElementsByTagName('w:tr');
        for (let r = 0; r < rows.length; r++) {
          tableHtml += '<tr>';
          const cells = rows[r].getElementsByTagName('w:tc');
          for (let c = 0; c < cells.length; c++) {
            let cellText = '';
            const cellPs = cells[c].getElementsByTagName('w:p');
            for (let cp = 0; cp < cellPs.length; cp++) {
              let cpText = '';
              const walkNode = (n: Node) => {
                if (n.nodeType === Node.TEXT_NODE) {
                  cpText += n.textContent || '';
                  return;
                }
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as Element;
                const name = el.localName || el.nodeName.replace(/^.*:/, '');
                if (name === 'oMath' || name === 'oMathPara') {
                  const latex = cleanLatex(ommlToLatex(el));
                  if (latex) cpText += ` $${latex}$ `;
                  return;
                }
                if (name === 'blip') {
                  const embed = el.getAttribute('r:embed') || el.getAttribute('embed');
                  if (embed && mediaMap[embed]) {
                    tblImages.push(mediaMap[embed]);
                    cpText += ' [hình] ';
                  }
                }
                if (name === 't') {
                  cpText += el.textContent || '';
                  return;
                }
                for (let j = 0; j < el.childNodes.length; j++) walkNode(el.childNodes[j]);
              };
              walkNode(cellPs[cp]);
              cellText += (cellText ? ' ' : '') + cpText.trim();
            }
            tableHtml += `<td class="border border-slate-300 px-3 py-1.5">${cellText}</td>`;
            tblText += (tblText ? ' | ' : '') + cellText;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</table>';

        paragraphs.push({
          text: `[Bảng: ${tblText}]`,
          images: tblImages,
          isTable: true,
          tableHtml,
        });
      }
    }

    // Now organize paragraphs into Exam Codes, Sections, and Questions
    // Detect exam codes: look for "Mã đề \d+" or default to "1011"
    const parsedCodes = splitParagraphsIntoCodes(paragraphs);

    if (Object.keys(parsedCodes).length === 0) {
      return {
        success: false,
        codes: {},
        error: 'Không tìm thấy câu hỏi nào trong file Word. Vui lòng đảm bảo các câu hỏi bắt đầu bằng "Câu 1.", "Câu 2." và có các phần (PHẦN I, PHẦN II, PHẦN III).',
        detectedImagesCount: imageCount,
        hasMathTypeWarning: hasMathType,
      };
    }

    return {
      success: true,
      codes: parsedCodes,
      detectedImagesCount: imageCount,
      hasMathTypeWarning: hasMathType,
      mathTypeDetails: hasMathType
        ? 'Phát hiện file Word có chứa công thức MathType (OLE Equation.DSMT4). Các công thức này không thể đọc trực tiếp bằng OMML chuẩn của Word. Bạn nên dùng chức năng MathType → Convert Equations → OMML trong Word, hoặc lưu ảnh công thức trước khi tải lên.'
        : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      codes: {},
      error: `Lỗi đọc file Word .docx: ${err.message || 'Lỗi không xác định'}`,
      detectedImagesCount: 0,
    };
  }
}

/**
 * Splits document paragraphs into codes (e.g. 1011, 1012...) or single code
 */
function splitParagraphsIntoCodes(paragraphs: Array<{ text: string; images: string[]; isTable?: boolean; tableHtml?: string }>): Record<string, ExamCodeData> {
  const result: Record<string, ExamCodeData> = {};

  // Check if multiple codes exist: e.g. "Mã đề 1011", "Mã đề 1012"
  interface CodeSegment {
    code: string;
    paragraphs: typeof paragraphs;
  }

  const segments: CodeSegment[] = [];
  let currentCode = '1011';
  let currentParas: typeof paragraphs = [];

  for (const p of paragraphs) {
    const codeMatch = p.text.match(/Mã\s*(?:đề|thi)[:\s]+(\d+)/i);
    if (codeMatch && codeMatch[1]) {
      if (currentParas.length > 0) {
        segments.push({ code: currentCode, paragraphs: currentParas });
        currentParas = [];
      }
      currentCode = codeMatch[1];
    }
    currentParas.push(p);
  }

  if (currentParas.length > 0) {
    segments.push({ code: currentCode, paragraphs: currentParas });
  }

  // Parse questions for each code segment
  for (const seg of segments) {
    const questions = parseQuestionsFromParagraphs(seg.paragraphs);
    if (questions.length > 0) {
      const p1 = questions.filter((q) => q.type === 'part1');
      const p2 = questions.filter((q) => q.type === 'part2');
      const p3 = questions.filter((q) => q.type === 'part3');

      result[seg.code] = {
        code: seg.code,
        questions,
        part1Count: p1.length,
        part2Count: p2.length,
        part3Count: p3.length,
        maxRawPoints: p1.length * 0.25 + p2.length * 1.0 + p3.length * 0.5,
      };
    }
  }

  return result;
}

/**
 * Parses questions from paragraphs within a code segment
 * Strictly respects section headers (PHẦN I, PHẦN II, PHẦN III)
 * Strictly distinguishes "Câu" (capitalized, start of question) from "câu" (lowercase, in instruction lines)
 */
function parseQuestionsFromParagraphs(
  paragraphs: Array<{ text: string; images: string[]; isTable?: boolean; tableHtml?: string }>
): Question[] {
  const questions: Question[] = [];
  let currentPart: QuestionType = 'part1';
  let currentQ: Partial<Question> | null = null;
  let currentOptions: Record<string, string> & { A: string; B: string; C: string; D: string } = { A: '', B: '', C: '', D: '' };
  let currentStatements: StatementItem[] = [];
  let currentOptionKey: string | null = null;
  let currentStatementKey: 'a' | 'b' | 'c' | 'd' | null = null;
  let qNumber = 0;

  const commitQuestion = () => {
    if (currentQ && currentQ.stem !== undefined) {
      const finalQ: Question = {
        id: currentQ.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        number: currentQ.number || qNumber,
        type: currentQ.type || currentPart,
        stem: currentQ.stem.trim(),
        image: currentQ.image,
        correctAnswer: currentQ.correctAnswer,
        sourceAnswer: currentQ.sourceAnswer,
      };

      if (finalQ.type === 'part1') {
        finalQ.options = {
          A: currentOptions.A || '',
          B: currentOptions.B || '',
          C: currentOptions.C || '',
          D: currentOptions.D || '',
        };
      } else if (finalQ.type === 'part2') {
        // Ensure statements a, b, c, d exist
        const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
        const stmts: StatementItem[] = [];
        for (const k of keys) {
          const found = currentStatements.find((s) => s.key === k);
          stmts.push(found || { key: k, text: `Ý ${k}` });
        }
        finalQ.statements = stmts;
        finalQ.correctAnswers = currentQ.correctAnswers;
        finalQ.sourceAnswersPart2 = currentQ.sourceAnswersPart2;
      } else if (finalQ.type === 'part3') {
        // Short answer
      }

      questions.push(finalQ);
    }

    currentQ = null;
    currentOptions = { A: '', B: '', C: '', D: '' };
    currentStatements = [];
    currentOptionKey = null;
    currentStatementKey = null;
  };

  for (const p of paragraphs) {
    const text = p.text;

    // Check for Section Titles:
    if (/PHẦN\s+I\b/i.test(text) && !/PHẦN\s+II\b/i.test(text) && !/PHẦN\s+III\b/i.test(text)) {
      commitQuestion();
      currentPart = 'part1';
      continue;
    }
    if (/PHẦN\s+II\b/i.test(text) && !/PHẦN\s+III\b/i.test(text)) {
      commitQuestion();
      currentPart = 'part2';
      continue;
    }
    if (/PHẦN\s+III\b/i.test(text)) {
      commitQuestion();
      currentPart = 'part3';
      continue;
    }

    // Check instruction lines (e.g. "Thí sinh trả lời từ câu 1 đến câu 12.") -> IGNORE!
    // Notice instruction lines use lowercase "câu", not capital "Câu"
    if (/^Thí\s*sinh\s*trả\s*lời\s*từ\s*câu/i.test(text) || /^Trong\s*mỗi\s*ý\s*a\)/i.test(text)) {
      continue;
    }

    // Check Question Start: "Câu 1.", "Câu 2:" (Capitalized "Câu" followed by digits)
    const qMatch = text.match(/^Câu\s+(\d+)[\.:\s]+(.*)$/);
    if (qMatch) {
      commitQuestion();
      qNumber = parseInt(qMatch[1], 10);
      const remainingStem = qMatch[2] || '';

      currentQ = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        number: qNumber,
        type: currentPart,
        stem: remainingStem,
        image: p.images.length > 0 ? {
          dataUrl: p.images[0],
          position: 'after_stem',
          align: 'center',
          width: 480,
        } : undefined,
      };

      // Check if options/statements are on the same line as the question
      parseInlineOptionsOrStatements(remainingStem, currentPart, {
        onOption: (k, v) => { currentOptions[k] = v; },
        onStatement: (k, v) => { currentStatements.push({ key: k, text: v }); },
        onAnswer: (ans) => {
          if (currentQ) {
            currentQ.sourceAnswer = ans;
            currentQ.correctAnswer = ans;
          }
        },
      });

      continue;
    }

    // If we are currently inside a question
    if (currentQ) {
      // If paragraph contains a table
      if (p.isTable && p.tableHtml) {
        currentQ.stem = (currentQ.stem || '') + '\n' + p.tableHtml;
        continue;
      }

      // Check for Image in question
      if (p.images.length > 0 && !currentQ.image) {
        currentQ.image = {
          dataUrl: p.images[0],
          position: 'after_stem',
          align: 'center',
          width: 480,
        };
      }

      if (currentPart === 'part1') {
        // Detect Options: A. / B. / C. / D.
        const optMatch = text.match(/^([A-D])[\.\)]\s*(.*)$/);
        if (optMatch) {
          const optLetter = optMatch[1].toUpperCase();
          currentOptionKey = optLetter;
          currentOptions[optLetter] = optMatch[2] || '';
          // Check if multiple options are on the same line (e.g. A. 1   B. 2   C. 3   D. 4)
          parseInlineOptions(optMatch[2] || '', (k, v) => {
            currentOptions[k] = v;
          });
          continue;
        }

        // Check if there is an Answer marker e.g. "Đáp án: A"
        const ansMatch = text.match(/Đáp\s*án\s*[:\s]+([A-D])/i);
        if (ansMatch) {
          currentQ.sourceAnswer = ansMatch[1].toUpperCase();
          currentQ.correctAnswer = ansMatch[1].toUpperCase();
          continue;
        }

        // Otherwise append to current option or stem
        if (currentOptionKey && currentOptions[currentOptionKey] !== undefined) {
          currentOptions[currentOptionKey] += ' ' + text;
        } else {
          currentQ.stem += '\n' + text;
        }
      } else if (currentPart === 'part2') {
        // Detect statements: a) / b) / c) / d)
        const stmtMatch = text.match(/^([a-d])\)\s*(.*)$/);
        if (stmtMatch) {
          const key = stmtMatch[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
          currentStatementKey = key;
          const content = stmtMatch[2] || '';
          currentStatements.push({ key, text: content });
          continue;
        }

        // Check if Part 2 answers are listed e.g. "Đáp án: a - Đ, b - S, c - Đ, d - S"
        const p2AnsMatch = text.match(/Đáp\s*án\s*[:\s]+(.*)$/i);
        if (p2AnsMatch) {
          const ansStr = p2AnsMatch[1];
          const ca: any = {};
          const items = ansStr.match(/([a-d])\s*[-:\s]+\s*([ĐSđs])/gi);
          if (items) {
            for (const it of items) {
              const m = it.match(/([a-d])\s*[-:\s]+\s*([ĐSđs])/i);
              if (m) {
                const k = m[1].toLowerCase();
                const v = m[2].toUpperCase() === 'S' ? 'S' : 'Đ';
                ca[k] = v;
              }
            }
            currentQ.correctAnswers = ca;
            currentQ.sourceAnswersPart2 = ca;
          }
          continue;
        }

        // Otherwise append to current statement or stem
        if (currentStatementKey) {
          const found = currentStatements.find((s) => s.key === currentStatementKey);
          if (found) {
            found.text += ' ' + text;
          }
        } else {
          currentQ.stem += '\n' + text;
        }
      } else if (currentPart === 'part3') {
        // Part 3: Short answer
        const ansMatch = text.match(/Đáp\s*án\s*[:\s]+([^\s]+)/i);
        if (ansMatch) {
          currentQ.sourceAnswer = ansMatch[1].trim();
          currentQ.correctAnswer = ansMatch[1].trim();
          continue;
        }
        currentQ.stem += '\n' + text;
      }
    }
  }

  commitQuestion();
  return questions;
}

/**
 * Checks for options on the same line: "A. 1 B. 2 C. 3 D. 4"
 */
function parseInlineOptions(text: string, onOption: (k: string, v: string) => void) {
  const regex = /\b([B-D])[\.\)]\s*([^A-D\.\)]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    onOption(match[1].toUpperCase(), match[2].trim());
  }
}

/**
 * Checks inline options, statements or answers on stem line
 */
function parseInlineOptionsOrStatements(
  text: string,
  part: QuestionType,
  callbacks: {
    onOption: (k: string, v: string) => void;
    onStatement: (k: 'a' | 'b' | 'c' | 'd', v: string) => void;
    onAnswer: (ans: string) => void;
  }
) {
  if (part === 'part1') {
    const aMatch = text.match(/\bA[\.\)]\s*(.*)$/);
    if (aMatch) {
      parseInlineOptions(aMatch[0], callbacks.onOption);
    }
  } else if (part === 'part2') {
    const stmtRegex = /\b([a-d])\)\s*([^a-d\)]+)/g;
    let match;
    while ((match = stmtRegex.exec(text)) !== null) {
      callbacks.onStatement(match[1].toLowerCase() as any, match[2].trim());
    }
  }
  const ansMatch = text.match(/Đáp\s*án\s*[:\s]+([^\s]+)/i);
  if (ansMatch) {
    callbacks.onAnswer(ansMatch[1].trim());
  }
}

/**
 * Parses JSON file (tron-de.json from app 1)
 */
export function parseJSONExamFile(jsonContent: string): {
  success: boolean;
  codes: Record<string, ExamCodeData>;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonContent);

    // Support both direct code dictionary or questions array
    const codesData: Record<string, ExamCodeData> = {};

    if (data.codes && typeof data.codes === 'object') {
      for (const code of Object.keys(data.codes)) {
        const rawCodeData = data.codes[code];
        const questions: Question[] = [];

        if (Array.isArray(rawCodeData.questions)) {
          for (let i = 0; i < rawCodeData.questions.length; i++) {
            const rawQ = rawCodeData.questions[i];
            const qType: QuestionType = rawQ.type || (rawQ.statements ? 'part2' : rawQ.options ? 'part1' : 'part3');
            const q: Question = {
              id: rawQ.id || `q_${code}_${i + 1}`,
              number: rawQ.number || i + 1,
              type: qType,
              stem: rawQ.stem || rawQ.content || '',
              options: rawQ.options,
              statements: rawQ.statements,
              correctAnswer: rawQ.correctAnswer || rawQ.answer,
              sourceAnswer: rawQ.sourceAnswer || rawQ.correctAnswer || rawQ.answer,
              correctAnswers: rawQ.correctAnswers,
              sourceAnswersPart2: rawQ.sourceAnswersPart2 || rawQ.correctAnswers,
              image: rawQ.image,
            };
            questions.push(q);
          }
        }

        const p1 = questions.filter((q) => q.type === 'part1');
        const p2 = questions.filter((q) => q.type === 'part2');
        const p3 = questions.filter((q) => q.type === 'part3');

        codesData[code] = {
          code,
          questions,
          part1Count: p1.length,
          part2Count: p2.length,
          part3Count: p3.length,
          maxRawPoints: p1.length * 0.25 + p2.length * 1.0 + p3.length * 0.5,
        };
      }
    } else if (data.questions && Array.isArray(data.questions)) {
      // Single code or root questions
      const code = data.code || '1011';
      const questions: Question[] = data.questions.map((rawQ: any, idx: number) => {
        const qType: QuestionType = rawQ.type || (rawQ.statements ? 'part2' : rawQ.options ? 'part1' : 'part3');
        return {
          id: rawQ.id || `q_${code}_${idx + 1}`,
          number: rawQ.number || idx + 1,
          type: qType,
          stem: rawQ.stem || rawQ.content || '',
          options: rawQ.options,
          statements: rawQ.statements,
          correctAnswer: rawQ.correctAnswer || rawQ.answer,
          sourceAnswer: rawQ.sourceAnswer || rawQ.correctAnswer || rawQ.answer,
          correctAnswers: rawQ.correctAnswers,
          sourceAnswersPart2: rawQ.sourceAnswersPart2 || rawQ.correctAnswers,
          image: rawQ.image,
        };
      });

      const p1 = questions.filter((q) => q.type === 'part1');
      const p2 = questions.filter((q) => q.type === 'part2');
      const p3 = questions.filter((q) => q.type === 'part3');

      codesData[code] = {
        code,
        questions,
        part1Count: p1.length,
        part2Count: p2.length,
        part3Count: p3.length,
        maxRawPoints: p1.length * 0.25 + p2.length * 1.0 + p3.length * 0.5,
      };
    }

    if (Object.keys(codesData).length === 0) {
      return {
        success: false,
        codes: {},
        error: 'File JSON không chứa cấu trúc đề thi hợp lệ (cần trường codes hoặc questions).',
      };
    }

    return {
      success: true,
      codes: codesData,
    };
  } catch (err: any) {
    return {
      success: false,
      codes: {},
      error: `Lỗi đọc file JSON: ${err.message || 'Cú pháp JSON không hợp lệ'}`,
    };
  }
}
