import { Injectable, Logger } from '@nestjs/common';
import type { Application, JobPosting } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface InboundMailMeta {
  fromAddress: string;
  fromName?: string;
  subject: string;
  bodyText: string;
}

interface MatchResult {
  applicationId: string;
  /** 0..1 — score combining sender domain + subject overlap. */
  matchConfidence: number;
  /** Human-readable reason (audit-trail only). */
  matchReason: string;
}

/**
 * Matches an inbound email to a candidate `Application` for the user.
 *
 * Heuristic — deliberately simple, no LLM call:
 *   1. Pull the user's recent applications (last 90 days, not soft-deleted)
 *   2. For each, score:
 *      +0.6  if sender domain (acme.com) matches a token in jobPosting.company
 *      +0.4  if subject contains jobPosting.company name
 *      +0.2  if subject contains jobPosting.title
 *   3. Pick the highest-scoring match above MIN_MATCH_SCORE.
 *
 * The orchestrator will only flip the application status when classifier
 * AND matcher are both confident enough.
 */
@Injectable()
export class MailboxMatcherService {
  private readonly logger = new Logger(MailboxMatcherService.name);

  /** Below this threshold we record the event but do not link it to an application. */
  static readonly MIN_MATCH_SCORE = 0.5;

  /** Look-back window when scanning candidate applications. */
  private static readonly LOOKBACK_DAYS = 90;

  constructor(private readonly prisma: PrismaService) {}

  async match(
    userId: string,
    mail: InboundMailMeta,
  ): Promise<MatchResult | null> {
    const since = new Date(Date.now() - MailboxMatcherService.LOOKBACK_DAYS * 86_400_000);

    const candidates = await this.prisma.application.findMany({
      where: {
        userId,
        deletedAt: null,
        createdAt: { gte: since },
      },
      include: { jobPosting: true },
      orderBy: { createdAt: 'desc' },
      take: 100, // safety cap; very few users will have more than this in 90d
    });

    if (candidates.length === 0) return null;

    const senderDomain = extractDomain(mail.fromAddress);
    const subjectLower = mail.subject.toLowerCase();

    let best: MatchResult | null = null;

    for (const app of candidates) {
      const score = scoreApplication(app, app.jobPosting, {
        senderDomain,
        subjectLower,
      });
      if (!best || score.score > best.matchConfidence) {
        best = {
          applicationId: app.id,
          matchConfidence: score.score,
          matchReason: score.reason,
        };
      }
    }

    if (!best || best.matchConfidence < MailboxMatcherService.MIN_MATCH_SCORE) {
      return null;
    }
    return best;
  }
}

interface ScoreContext {
  senderDomain: string | null;
  subjectLower: string;
}

function scoreApplication(
  app: Application & { jobPosting: JobPosting | null },
  job: JobPosting | null,
  ctx: ScoreContext,
): { score: number; reason: string } {
  if (!job) return { score: 0, reason: 'no job posting' };

  const reasons: string[] = [];
  let score = 0;

  const companyTokens = tokenize(job.company);
  const titleTokens = tokenize(job.title);

  // Sender domain vs. company name (best signal).
  if (ctx.senderDomain) {
    const domainCore = ctx.senderDomain.split('.')[0]; // "careers.acme.com" -> "careers", "acme.com" -> "acme"
    const allDomainParts = ctx.senderDomain.split('.');
    const matchesCompany = companyTokens.some((tok) =>
      allDomainParts.some((part) => part === tok || part.includes(tok) || tok.includes(part)),
    );
    if (matchesCompany) {
      score += 0.6;
      reasons.push(`Absender-Domain ${ctx.senderDomain} passt zu ${job.company}`);
    } else if (companyTokens.includes(domainCore)) {
      score += 0.5;
      reasons.push(`Absender-Domain ${ctx.senderDomain} passt zu ${job.company}`);
    }
  }

  // Company name in subject.
  if (companyTokens.some((tok) => ctx.subjectLower.includes(tok))) {
    score += 0.4;
    reasons.push(`Betreff enthält ${job.company}`);
  }

  // Job title in subject (weaker signal, often truncated).
  if (titleTokens.length > 0 && titleTokens.some((tok) => ctx.subjectLower.includes(tok))) {
    score += 0.2;
    reasons.push(`Betreff erwähnt ${job.title}`);
  }

  return {
    score: Math.min(score, 1),
    reason: reasons.join(' · ') || 'kein klares Signal',
  };
}

/**
 * Extract a normalized domain from an email address.
 * Returns lowercase domain without leading "www." or "mail." subdomain noise.
 */
function extractDomain(addr: string): string | null {
  const at = addr.indexOf('@');
  if (at < 0 || at === addr.length - 1) return null;
  let domain = addr.slice(at + 1).toLowerCase().trim();
  domain = domain.replace(/^(www|mail|smtp|email|noreply|no-reply)\./, '');
  return domain || null;
}

/**
 * Tokenize a free-text string into lowercase keywords with stop-words and
 * punctuation removed. Used for fuzzy substring matching.
 */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok));
}

const STOP_WORDS = new Set([
  'gmbh',
  'ag',
  'kg',
  'co',
  'inc',
  'ltd',
  'llc',
  'group',
  'the',
  'and',
  'der',
  'die',
  'das',
  'und',
  'für',
  'mit',
  'job',
  'jobs',
  'application',
  'bewerbung',
]);
