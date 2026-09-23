import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { notifyDiscord, type DiscordField, type DiscordLevel } from '../discord';

type CaseStatus = 'PASS' | 'WARNING' | 'FAIL' | 'SKIPPED';

type CaseRecord = {
  title: string;
  status: CaseStatus;
  durationMs: number;
  notes: string[];
};

const PROJECT_NAMES = ['chromium', 'visual', 'visual-setup', 'cms'];

function shortTitle(test: TestCase): string {
  // e.g. "chromium › 10-flow-v5.spec.ts › Luồng liên tục · A. WEB V5 › HC-V5-01..."
  const parts = test.titlePath().filter(Boolean);
  // Drop project name nếu có (chromium / visual / visual-setup)
  const rest = PROJECT_NAMES.includes(parts[0]?.toLowerCase() || '') ? parts.slice(1) : parts;
  const file = rest[0]?.replace(/\.spec\.ts$|\.setup\.ts$/i, '') || '';
  const name = rest.slice(1).join(' › ') || test.title;
  return file ? `${file} · ${name}` : name;
}

/** Playwright ghi call log kèm mã màu ANSI (vd. \x1B[2m...\x1B[22m) — bỏ đi trước khi gửi Discord,
 * nếu không sẽ hiện thành ký tự lỗi (�[2m...) trong tin nhắn. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '';
  return `${(ms / 1000).toFixed(1)}s`;
}

function chunkLines(lines: string[], maxLen = 1000): string[] {
  if (!lines.length) return [];
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLen) {
      if (current) chunks.push(current);
      current = line.slice(0, maxLen);
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function isQuanTri(test: TestCase): boolean {
  const project = test.parent?.project?.()?.name?.toLowerCase() || '';
  if (project === 'cms') return true;
  return /[\\/]cms[\\/]/.test(test.location?.file || '');
}

class DiscordReporter implements Reporter {
  private cases: CaseRecord[] = [];
  private quanTri = false;

  onTestEnd(test: TestCase, result: TestResult) {
    if (isQuanTri(test)) this.quanTri = true;
    const title = shortTitle(test);
    const notes: string[] = [];

    for (const a of result.attachments) {
      if ((a.name === 'timing' || a.name === 'timing-warning' || a.name === 'result') && a.body) {
        notes.push(a.body.toString('utf8').trim());
      }
    }

    let status: CaseStatus = 'PASS';
    if (result.status === 'skipped') status = 'SKIPPED';
    else if (result.status === 'failed' || result.status === 'timedOut') {
      status = 'FAIL';
      const err = stripAnsi(result.error?.message || 'Unknown error')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('Call log') && !l.startsWith('at '))
        .slice(0, 4)
        .join(' | ')
        .replace(/\s+/g, ' ')
        .trim();
      if (err) notes.push(err.slice(0, 280));
    } else if (result.attachments.some((a) => a.name === 'timing-warning')) {
      status = 'WARNING';
    }

    this.cases.push({
      title,
      status,
      durationMs: result.duration,
      notes: [...new Set(notes)],
    });
  }

  async onEnd(result: FullResult) {
    const passed = this.cases.filter((c) => c.status === 'PASS');
    const warnings = this.cases.filter((c) => c.status === 'WARNING');
    const failed = this.cases.filter((c) => c.status === 'FAIL');
    const skipped = this.cases.filter((c) => c.status === 'SKIPPED');

    const level: DiscordLevel =
      failed.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARNING' : 'INFO';

    const suite = this.quanTri ? 'Auto Check Web Quản Trị' : 'Auto Check Web Học Thi';
    const headline =
      level === 'FAIL'
        ? `${suite} · CÓ LỖI`
        : level === 'WARNING'
          ? `${suite} · CÓ WARNING`
          : `${suite} · PASS`;

    const summary = [
      `**Tổng kết:** ${result.status.toUpperCase()}`,
      `PASS: **${passed.length}** · WARNING: **${warnings.length}** · FAIL: **${failed.length}** · SKIP: **${skipped.length}** · Tổng: **${this.cases.length}**`,
      '',
      this.quanTri
        ? '_Ngưỡng thời gian chỉ cho đăng nhập và đăng xuất: Pass ≤ 4s · Warning ≤ 6s · Fail > 6s. Menu chính không tính giờ._'
        : '_Ngưỡng thời gian: Pass ≤ 4s · Warning ≤ 6s · Fail > 6s_',
    ].join('\n');

    const fields: DiscordField[] = [];

    const toLines = (list: CaseRecord[], withNotes: boolean) =>
      list.map((c) => {
        const dur = formatDuration(c.durationMs);
        const head = dur ? `**${c.title}** (${dur})` : `**${c.title}**`;
        if (!withNotes || !c.notes.length) return head;
        return `${head}\n   ↳ ${c.notes.join(' · ')}`;
      });

    const pushSection = (emoji: string, label: string, list: CaseRecord[], withNotes: boolean) => {
      if (!list.length) {
        fields.push({ name: `${emoji} ${label} (0)`, value: '_Không có_' });
        return;
      }
      const chunks = chunkLines(toLines(list, withNotes));
      chunks.forEach((chunk, i) => {
        fields.push({
          name: i === 0 ? `${emoji} ${label} (${list.length})` : `${emoji} ${label} (tiếp)` ,
          value: chunk,
        });
      });
    };

    pushSection('✅', 'PASS', passed, true);
    pushSection('⚠️', 'WARNING', warnings, true);
    pushSection('❌', 'FAIL / ERROR', failed, true);
    if (skipped.length) pushSection('⏭️', 'SKIPPED', skipped, false);

    await notifyDiscord({
      title: headline,
      level,
      details: summary,
      fields,
      footer: suite,
    });
  }
}

export default DiscordReporter;
