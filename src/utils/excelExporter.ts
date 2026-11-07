import * as XLSX from 'xlsx';
import { StudentSubmission } from '../types';

export function exportSubmissionsToExcel(
  submissions: StudentSubmission[],
  examTitle: string = 'Ket_qua_thi_online'
) {
  // Build rows with exact 16 columns specified
  const rows = submissions.map((sub, index) => {
    return {
      'STT': index + 1,
      'Họ và tên': sub.studentInfo.fullName || '',
      'Trường': sub.studentInfo.school || '',
      'Lớp': sub.studentInfo.className || '',
      'Năm học': sub.studentInfo.schoolYear || '',
      'Số báo danh': sub.studentInfo.studentId || '',
      'Mã đề': sub.studentInfo.examCode || '',
      'Phòng thi': sub.studentInfo.room || '',
      'Điểm thang 10': sub.score10,
      'Điểm thô': sub.rawScore,
      'Điểm tối đa': sub.maxRawScore,
      'Điểm Phần I': sub.scorePart1,
      'Điểm Phần II': sub.scorePart2,
      'Điểm Phần III': sub.scorePart3,
      'Số lần vi phạm quy chế thi (số lần rời màn hình)': sub.violationCount,
      'Trạng thái': sub.status,
      'Thời gian nộp bài': sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleString('vi-VN')
        : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 24 }, // Họ và tên
    { wch: 28 }, // Trường
    { wch: 10 }, // Lớp
    { wch: 12 }, // Năm học
    { wch: 14 }, // SBD
    { wch: 10 }, // Mã đề
    { wch: 12 }, // Phòng thi
    { wch: 14 }, // Điểm thang 10
    { wch: 12 }, // Điểm thô
    { wch: 12 }, // Điểm tối đa
    { wch: 14 }, // Điểm Phần I
    { wch: 14 }, // Điểm Phần II
    { wch: 14 }, // Điểm Phần III
    { wch: 22 }, // Số lần vi phạm
    { wch: 32 }, // Trạng thái
    { wch: 20 }, // Thời gian nộp
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kết quả thi');

  const safeFilename = `${examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}_Ket_Qua.xlsx`;
  XLSX.writeFile(workbook, safeFilename);
}
