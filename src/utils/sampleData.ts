import QRCode from 'qrcode';

/**
 * Standard test QR data according to prompt specifications:
 * Multiple codes: e.g. 1011 and 1012 (or 2345 and 2346)
 * Part I: 12 multiple choice
 * Part II: 4 True/False (each with 4 statements)
 * Part III: 3 short answers
 */
export const SAMPLE_QR_OBJECT = {
  success: true,
  type: 5,
  '1011': 'ACBCABADACDD#SĐĐS_ĐSSĐ_SĐSĐ_ĐĐSS#10_4_3,9',
  '1012': 'BACADACDBDDC#ĐSSĐ_ĐSĐS_ĐĐSS_SĐSĐ#10_3_23',
};

export const SAMPLE_QR_STRING = JSON.stringify(SAMPLE_QR_OBJECT);

/**
 * Generates and downloads a clean QR code image file (.png)
 */
export async function downloadSampleQRImage(filename = 'ma_qr_dap_an_mau.png') {
  try {
    const dataUrl = await QRCode.toDataURL(SAMPLE_QR_STRING, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Lỗi khi tạo ảnh mã QR:', err);
    alert('Không thể tạo ảnh mã QR: ' + err);
  }
}

/**
 * Generates and downloads a sample JSON exam file (tron-de.json)
 * Exactly matching SAMPLE_QR_OBJECT for codes 1011 and 1012
 */
export function downloadSampleExamJSON(filename = 'tron-de-mau.json') {
  const sampleExamData = {
    title: 'Đề thi Toán giữa kỳ I Lớp 12',
    codes: {
      '1011': {
        code: '1011',
        questions: [
          // Part I: 12 MC questions matching 'ACBCABADACDD'
          {
            number: 1,
            type: 'part1',
            stem: 'Cho hàm số $y = f(x)$ có bảng xét dấu đạo hàm như sau. Hàm số đồng biến trên khoảng nào?',
            options: {
              A: '$(-\\infty; 0)$',
              B: '$(0; 2)$',
              C: '$(2; +\\infty)$',
              D: '$(-\\infty; 2)$',
            },
            correctAnswer: 'A',
            sourceAnswer: 'A',
          },
          {
            number: 2,
            type: 'part1',
            stem: 'Tìm tập xác định của hàm số $y = \\log_2(x - 3)$.',
            options: {
              A: '$\\mathbb{R} \\setminus \\{3\\}$',
              B: '$[3; +\\infty)$',
              C: '$(3; +\\infty)$',
              D: '$(-\\infty; 3)$',
            },
            correctAnswer: 'C',
            sourceAnswer: 'C',
          },
          {
            number: 3,
            type: 'part1',
            stem: 'Hàm số $y = x^3 - 3x + 2$ đạt cực tiểu tại điểm nào?',
            options: {
              A: '$x = -1$',
              B: '$x = 1$',
              C: '$x = 0$',
              D: '$x = 2$',
            },
            correctAnswer: 'B',
            sourceAnswer: 'B',
          },
          {
            number: 4,
            type: 'part1',
            stem: 'Tính giới hạn $L = \\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$.',
            options: {
              A: '$2$',
              B: '$0$',
              C: '$4$',
              D: '$+\\infty$',
            },
            correctAnswer: 'C',
            sourceAnswer: 'C',
          },
          {
            number: 5,
            type: 'part1',
            stem: 'Đồ thị hàm số $y = \\frac{2x - 1}{x + 1}$ có đường tiệm cận đứng là:',
            options: {
              A: '$x = -1$',
              B: '$x = 2$',
              C: '$y = 2$',
              D: '$y = -1$',
            },
            correctAnswer: 'A',
            sourceAnswer: 'A',
          },
          {
            number: 6,
            type: 'part1',
            stem: 'Nghiệm của phương trình $2^{x + 1} = 16$ là:',
            options: {
              A: '$x = 4$',
              B: '$x = 3$',
              C: '$x = 2$',
              D: '$x = 5$',
            },
            correctAnswer: 'B',
            sourceAnswer: 'B',
          },
          {
            number: 7,
            type: 'part1',
            stem: 'Giá trị lớn nhất của hàm số $f(x) = -x^2 + 4x$ trên $[0; 3]$ là:',
            options: {
              A: '$4$',
              B: '$3$',
              C: '$0$',
              D: '$5$',
            },
            correctAnswer: 'A',
            sourceAnswer: 'A',
          },
          {
            number: 8,
            type: 'part1',
            stem: 'Đạo hàm của hàm số $y = e^{2x}$ là:',
            options: {
              A: '$y\' = e^{2x}$',
              B: '$y\' = \\frac{1}{2} e^{2x}$',
              C: '$y\' = 2x e^{2x-1}$',
              D: '$y\' = 2e^{2x}$',
            },
            correctAnswer: 'D',
            sourceAnswer: 'D',
          },
          {
            number: 9,
            type: 'part1',
            stem: 'Cho hình chóp $S.ABC$ có đáy là tam giác vuông tại $B$, $SA \\perp (ABC)$. Góc giữa $SB$ và $(ABC)$ là góc nào?',
            options: {
              A: '$\\widehat{SBA}$',
              B: '$\\widehat{SCA}$',
              C: '$\\widehat{SAB}$',
              D: '$\\widehat{ASB}$',
            },
            correctAnswer: 'A',
            sourceAnswer: 'A',
          },
          {
            number: 10,
            type: 'part1',
            stem: 'Số nghiệm nguyên của bất phương trình $x^2 - 5x + 4 \\le 0$ là:',
            options: {
              A: '$2$',
              B: '$3$',
              C: '$4$',
              D: '$5$',
            },
            correctAnswer: 'C',
            sourceAnswer: 'C',
          },
          {
            number: 11,
            type: 'part1',
            stem: 'Tích phân $\\int_{0}^{1} 2x dx$ bằng:',
            options: {
              A: '$2$',
              B: '$\\frac{1}{2}$',
              C: '$0$',
              D: '$1$',
            },
            correctAnswer: 'D',
            sourceAnswer: 'D',
          },
          {
            number: 12,
            type: 'part1',
            stem: 'Trong không gian $Oxyz$, tọa độ của vectơ $\\vec{u} = 2\\vec{i} - 3\\vec{j} + \\vec{k}$ là:',
            options: {
              A: '$(2; 3; 1)$',
              B: '$(-2; 3; -1)$',
              C: '$(2; -3; -1)$',
              D: '$(2; -3; 1)$',
            },
            correctAnswer: 'D',
            sourceAnswer: 'D',
          },

          // Part II: 4 True/False questions matching 'SĐĐS_ĐSSĐ_SĐSĐ_ĐĐSS'
          {
            number: 13,
            type: 'part2',
            stem: 'Cho hàm số bậc ba $y = f(x) = x^3 - 3x^2 + 2$. Xét tính đúng sai của các mệnh đề sau:',
            statements: [
              { key: 'a', text: 'Hàm số đồng biến trên khoảng $(0; 2)$.', locked: false },
              { key: 'b', text: 'Hàm số có hai điểm cực trị.', locked: false },
              { key: 'c', text: 'Đồ thị hàm số đi qua điểm $A(0; 2)$.', locked: false },
              { key: 'd', text: 'Giá trị cực tiểu của hàm số bằng $2$.', locked: false },
            ],
            correctAnswers: { a: 'S', b: 'Đ', c: 'Đ', d: 'S' },
            sourceAnswersPart2: { a: 'S', b: 'Đ', c: 'Đ', d: 'S' },
          },
          {
            number: 14,
            type: 'part2',
            stem: 'Cho hình hộp chữ nhật $ABCD.A\'B\'C\'D\'$ có đáy $ABCD$ là hình vuông cạnh $a$ và $AA\' = 2a$.',
            statements: [
              { key: 'a', text: 'Thể tích khối hộp chữ nhật bằng $2a^3$.', locked: false },
              { key: 'b', text: 'Góc giữa hai đường thẳng $A\'B$ và $CD$ bằng $90^\\circ$.', locked: false },
              { key: 'c', text: 'Khoảng cách giữa hai mặt phẳng $(ABCD)$ và $(A\'B\'C\'D\')$ bằng $a$.', locked: false },
              { key: 'd', text: 'Độ dài đường chéo $AC\'$ bằng $a\\sqrt{6}$.', locked: false },
            ],
            correctAnswers: { a: 'Đ', b: 'S', c: 'S', d: 'Đ' },
            sourceAnswersPart2: { a: 'Đ', b: 'S', c: 'S', d: 'Đ' },
          },
          {
            number: 15,
            type: 'part2',
            stem: 'Cho bất phương trình $\\log_2(x^2 - x + 2) \\ge 1$.',
            statements: [
              { key: 'a', text: 'Điều kiện xác định của bất phương trình là $x \\in (0; +\\infty)$.', locked: false },
              { key: 'b', text: 'Bất phương trình tương đương với $x^2 - x \\ge 0$.', locked: false },
              { key: 'c', text: 'Tập nghiệm của bất phương trình là $[0; 1]$.', locked: false },
              { key: 'd', text: 'Bất phương trình có vô số nghiệm nguyên dương.', locked: false },
            ],
            correctAnswers: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
            sourceAnswersPart2: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
          },
          {
            number: 16,
            type: 'part2',
            stem: 'Một chất điểm chuyển động với phương trình $s(t) = -t^3 + 6t^2 + 9t$ với $t \\ge 0$ (t tính bằng giây, s tính bằng mét).',
            statements: [
              { key: 'a', text: 'Vận tốc tức thời tại thời điểm $t = 1$ là $18$ m/s.', locked: false },
              { key: 'b', text: 'Chất điểm đạt vận tốc lớn nhất tại thời điểm $t = 2$ giây.', locked: false },
              { key: 'c', text: 'Gia tốc tức thời tại thời điểm $t = 2$ bằng $0$ m/s$^2$.', locked: false },
              { key: 'd', text: 'Chất điểm dừng lại tại thời điểm $t = 5$ giây.', locked: false },
            ],
            correctAnswers: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
            sourceAnswersPart2: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
          },

          // Part III: 3 Short Answer questions matching '10_4_3,9'
          {
            number: 17,
            type: 'part3',
            stem: 'Một bể bơi hình chữ nhật có chu vi đáy bằng $28$ m. Chiều dài gấp rưỡi chiều rộng. Tìm chiều dài bể bơi (đơn vị: mét)?',
            correctAnswer: '10',
            sourceAnswer: '10',
          },
          {
            number: 18,
            type: 'part3',
            stem: 'Biết $\\int_{1}^{3} f(x) dx = 6$. Tính tích phân $I = \\int_{1}^{3} [2f(x) - 4] dx$.',
            correctAnswer: '4',
            sourceAnswer: '4',
          },
          {
            number: 19,
            type: 'part3',
            stem: 'Tính giá trị biểu thức $P = \\log_3 9 + 1,9$ (kết quả viết dưới dạng số thập phân).',
            correctAnswer: '3,9',
            sourceAnswer: '3,9',
          },
        ],
      },

      '1012': {
        code: '1012',
        questions: [
          // 12 MC questions matching 'BACADACDBDDC'
          { number: 1, type: 'part1', stem: 'Câu 1 mã 1012: $y = x^2 - 2x$. Cực trị?', options: { A: '1', B: '0', C: '2', D: '-1' }, correctAnswer: 'B', sourceAnswer: 'B' },
          { number: 2, type: 'part1', stem: 'Câu 2 mã 1012: Tập xác định $\\sqrt{x - 1}$?', options: { A: '$[1; +\\infty)$', B: '$(1; +\\infty)$', C: '$\\mathbb{R}$', D: '$(-\\infty; 1]$' }, correctAnswer: 'A', sourceAnswer: 'A' },
          { number: 3, type: 'part1', stem: 'Câu 3 mã 1012: Giới hạn $\\lim 1/n$?', options: { A: '1', B: '+\\infty', C: '0', D: '-1' }, correctAnswer: 'C', sourceAnswer: 'C' },
          { number: 4, type: 'part1', stem: 'Câu 4 mã 1012: $\\int 2x dx$?', options: { A: '$x^2 + C$', B: '$2x^2 + C$', C: '$x + C$', D: '$2$' }, correctAnswer: 'A', sourceAnswer: 'A' },
          { number: 5, type: 'part1', stem: 'Câu 5 mã 1012: Nghiệm $3^x = 9$?', options: { A: '3', B: '1', C: '0', D: '2' }, correctAnswer: 'D', sourceAnswer: 'D' },
          { number: 6, type: 'part1', stem: 'Câu 6 mã 1012: Số cạnh của tứ diện?', options: { A: '6', B: '4', C: '8', D: '5' }, correctAnswer: 'A', sourceAnswer: 'A' },
          { number: 7, type: 'part1', stem: 'Câu 7 mã 1012: Đường tiệm cận ngang $y = (x+1)/(x-1)$?', options: { A: '$y = 0$', B: '$x = 1$', C: '$y = 1$', D: '$y = -1$' }, correctAnswer: 'C', sourceAnswer: 'C' },
          { number: 8, type: 'part1', stem: 'Câu 8 mã 1012: Thể tích chóp đáy $S$ cao $h$?', options: { A: '$Sh$', B: '$\\frac{1}{2}Sh$', C: '$3Sh$', D: '$\\frac{1}{3}Sh$' }, correctAnswer: 'D', sourceAnswer: 'D' },
          { number: 9, type: 'part1', stem: 'Câu 9 mã 1012: Điểm cực đại $y = -x^2 + 4$?', options: { A: '$x = 2$', B: '$x = 0$', C: '$x = -2$', D: '$x = 4$' }, correctAnswer: 'B', sourceAnswer: 'B' },
          { number: 10, type: 'part1', stem: 'Câu 10 mã 1012: Đạo hàm $\\ln x$?', options: { A: '$1$', B: '$e^x$', C: '$\\frac{-1}{x^2}$', D: '$\\frac{1}{x}$' }, correctAnswer: 'D', sourceAnswer: 'D' },
          { number: 11, type: 'part1', stem: 'Câu 11 mã 1012: Mặt phẳng $(Oxy)$ có pt:', options: { A: '$x = 0$', B: '$y = 0$', C: '$x + y = 0$', D: '$z = 0$' }, correctAnswer: 'D', sourceAnswer: 'D' },
          { number: 12, type: 'part1', stem: 'Câu 12 mã 1012: $2x - 4 = 0$ có nghiệm:', options: { A: '$4$', B: '$1$', C: '$2$', D: '$-2$' }, correctAnswer: 'C', sourceAnswer: 'C' },

          // Part II: 4 True/False matching 'ĐSSĐ_ĐSĐS_ĐĐSS_SĐSĐ'
          {
            number: 13,
            type: 'part2',
            stem: 'Câu 13 mã 1012: Cho hàm số $f(x) = x^4 - 2x^2$.',
            statements: [
              { key: 'a', text: 'Hàm số có 3 điểm cực trị.', locked: false },
              { key: 'b', text: 'Hàm số đạt cực đại tại $x = 1$.', locked: false },
              { key: 'c', text: 'Đồ thị nhận trục tung làm trục đối xứng.', locked: false },
              { key: 'd', text: 'Hàm số đồng biến trên $(0; +\\infty)$.', locked: false },
            ],
            correctAnswers: { a: 'Đ', b: 'S', c: 'S', d: 'Đ' },
            sourceAnswersPart2: { a: 'Đ', b: 'S', c: 'S', d: 'Đ' },
          },
          {
            number: 14,
            type: 'part2',
            stem: 'Câu 14 mã 1012: Cho hình chóp tứ giác đều $S.ABCD$.',
            statements: [
              { key: 'a', text: 'Hình chiếu của $S$ lên $(ABCD)$ là tâm $O$ của đáy.', locked: false },
              { key: 'b', text: '$AC \\perp BD$.', locked: false },
              { key: 'c', text: '$SA = SB = SC = SD$.', locked: false },
              { key: 'd', text: 'Đáy $ABCD$ là hình thoi không vuông.', locked: false },
            ],
            correctAnswers: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
            sourceAnswersPart2: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
          },
          {
            number: 15,
            type: 'part2',
            stem: 'Câu 15 mã 1012: Xét phương trình $4^x - 2^{x+1} = 0$.',
            statements: [
              { key: 'a', text: 'Phương trình có đúng một nghiệm.', locked: false },
              { key: 'b', text: 'Nghiệm của phương trình là $x = 1$.', locked: false },
              { key: 'c', text: 'Tổng các nghiệm bằng $2$.', locked: false },
              { key: 'd', text: 'Đặt $t = 2^x$ ta được $t^2 - t = 0$.', locked: false },
            ],
            correctAnswers: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
            sourceAnswersPart2: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
          },
          {
            number: 16,
            type: 'part2',
            stem: 'Câu 16 mã 1012: Véctơ trong không gian $Oxyz$.',
            statements: [
              { key: 'a', text: '$\\vec{i} = (1; 0; 0)$ là véctơ đơn vị.', locked: false },
              { key: 'b', text: 'Độ dài véctơ $(1; 2; 2)$ bằng $3$.', locked: false },
              { key: 'c', text: 'Tích vô hướng bằng 0 thì hai véctơ vuông góc.', locked: false },
              { key: 'd', text: 'Tọa độ trọng tâm tam giác là trung bình cộng 3 đỉnh.', locked: false },
            ],
            correctAnswers: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
            sourceAnswersPart2: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
          },

          // Part III: 3 Short answers matching '10_3_23'
          {
            number: 17,
            type: 'part3',
            stem: 'Tìm số nghiệm nguyên của phương trình $|x - 5| = 5$.',
            correctAnswer: '10',
            sourceAnswer: '10',
          },
          {
            number: 18,
            type: 'part3',
            stem: 'Cho cấp số cộng có $u_1 = 1$, công sai $d = 2$. Tìm số hạng thứ 2: $u_2$?',
            correctAnswer: '3',
            sourceAnswer: '3',
          },
          {
            number: 19,
            type: 'part3',
            stem: 'Có bao nhiêu số tự nhiên có hai chữ số khác nhau lập từ $\\{1, 2, 3, 4, 5\\}$?',
            correctAnswer: '23',
            sourceAnswer: '23',
          },
        ],
      },
    },
  };

  const blob = new Blob([JSON.stringify(sampleExamData, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
