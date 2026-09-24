import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  baseUrl: process.env.BASE_URL || 'https://tnmath.edu.vn',
  apiUrl: process.env.API_URL || 'https://tne-prod-api.tnmath.edu.vn/apis',
  v5BaseUrl: process.env.V5_BASE_URL || 'https://trangnguyen.edu.vn',
  vnmfBaseUrl: process.env.VNMF_BASE_URL || 'https://vnmf.edu.vn',
  studentUser: required('STUDENT_USER'),
  studentPass: required('STUDENT_PASS'),
  discordWebhook: process.env.DISCORD_WEBHOOK_URL || '',
  courseId: required('COURSE_ID'),
  lessonId: required('LESSON_ID'),
  weekId: required('WEEK_ID'),
  learningMediaId: required('LEARNING_MEDIA_ID'),
  exerciseId: required('EXERCISE_ID'),
  examId: required('EXAM_ID'),
  practiceId: required('PRACTICE_ID'),
  practiceRoundId: required('PRACTICE_ROUND_ID'),
  /** HC-V5-02: sân chơi / chặng thi cố định (sheet), fallback nếu sân chính không mở. */
  v5ExamPlayground: process.env.V5_EXAM_PLAYGROUND || 'Sân chơi Toán học Việt Nam (VNMF)',
  v5ExamRound: process.env.V5_EXAM_ROUND || 'Khởi động',
  v5ExamFallbackPlayground: process.env.V5_EXAM_FALLBACK_PLAYGROUND || 'Trạng Nguyên Tiếng Việt',
  v5ExamFallbackRound: process.env.V5_EXAM_FALLBACK_ROUND || 'Vòng 1',
  passMaxMs: Number(process.env.PASS_MAX_MS || 4000),
  warningMaxMs: Number(process.env.WARNING_MAX_MS || 6000),
  /** Suite CMS (`npm run test:cms`) — không bắt buộc với `npm test`. */
  cms2BaseUrl: process.env.CMS2_BASE_URL || 'https://cms2.trangnguyen.edu.vn',
  cms2User: process.env.CMS2_USER || '',
  cms2Pass: process.env.CMS2_PASS || '',
  qtBaseUrl: process.env.QT_BASE_URL || 'https://quantri.trangnguyen.edu.vn',
  qtUser: process.env.QT_USER || '',
  qtPass: process.env.QT_PASS || '',
  cms5BaseUrl: process.env.CMS5_BASE_URL || 'https://admin.infra.trangnguyen.edu.vn/',
  cms5User: process.env.CMS5_USER || '',
  cms5Pass: process.env.CMS5_PASS || '',
  /** URL theo bảng tài khoản (admin.tnmath.edu.vn), không dùng header pre-uat trên sheet. */
  cms6BaseUrl: process.env.CMS6_BASE_URL || 'https://admin.tnmath.edu.vn/',
  cms6User: process.env.CMS6_USER || '',
  cms6Pass: process.env.CMS6_PASS || '',
  noiboBaseUrl: process.env.NOIBO_BASE_URL || 'https://noibo.trangnguyen.edu.vn/login',
  noiboUser: process.env.NOIBO_USER || '',
  noiboPass: process.env.NOIBO_PASS || '',
  cmsNewBaseUrl: process.env.CMSNEW_BASE_URL || 'https://cms-news.trangnguyen.edu.vn/admin/login',
  cmsNewUser: process.env.CMSNEW_USER || '',
  cmsNewPass: process.env.CMSNEW_PASS || '',
  admVnmfBaseUrl: process.env.ADMVNMF_BASE_URL || 'https://vnmf.edu.vn/admin',
  admVnmfUser: process.env.ADMVNMF_USER || '',
  admVnmfPass: process.env.ADMVNMF_PASS || '',
};

export function lessonUrl(): string {
  return `${env.baseUrl}/hoc-toan/${env.courseId}/${env.lessonId}`;
}

export function courseUrl(): string {
  return `${env.baseUrl}/hoc-toan/${env.courseId}`;
}

export function examAttemptUrl(): string {
  return `${env.baseUrl}/lam-bai-kiem-tra?week_id=${env.weekId}&category_id=${env.lessonId}&frame_id=${env.courseId}&call_back=${encodeURIComponent(`/hoc-toan/${env.courseId}/${env.lessonId}`)}`;
}

export function practiceListUrl(): string {
  return `${env.baseUrl}/luyen-toan?training=${env.practiceId}`;
}

export function practiceAttemptUrl(): string {
  return `${env.baseUrl}/lam-luyen-thi?frameIds=${env.courseId}&matrix_type_code=1&training_exam_id=${env.practiceId}&training_exam_round_id=${env.practiceRoundId}`;
}
