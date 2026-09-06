import { z } from 'zod';
import { Category, TaskId } from './ids';

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
} as const;
export const Viewport = z.enum(['mobile', 'tablet', 'desktop']);
export type Viewport = z.infer<typeof Viewport>;

/** Starts the produced app so gates and screenshots can hit it. */
export const Serve = z.object({
  run: z.string().min(1),
  /** Port the command listens on; the harness sets `PORT` to it too. */
  port: z.number().int().positive(),
  /** Path the harness polls until 200 before the gate runs. */
  readyPath: z.string().default('/'),
  readyTimeoutSeconds: z.number().int().positive().default(90),
});
export type Serve = z.infer<typeof Serve>;

/**
 * Deterministic gates run in order inside the run directory. The first failure stops the
 * sequence and the run scores zero on every subjective dimension.
 */
export const Gate = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('command'),
    id: z.string().min(1),
    run: z.string().min(1),
    timeoutSeconds: z.number().int().positive().default(600),
  }),
  z.object({
    type: z.literal('playwright'),
    id: z.string().min(1),
    /** Spec path relative to the task directory; copied into the run dir at gate time, never before. */
    spec: z.string().min(1),
    serve: Serve,
    timeoutSeconds: z.number().int().positive().default(600),
  }),
  z.object({
    type: z.literal('axe'),
    id: z.string().min(1),
    paths: z.array(z.string().min(1)).min(1),
    serve: Serve,
    /** Violations at or above this impact fail the gate. */
    failOn: z.enum(['minor', 'moderate', 'serious', 'critical']).default('serious'),
  }),
  z.object({
    type: z.literal('http-contract'),
    id: z.string().min(1),
    /** Contract test file relative to the task directory (a `bun test` file that reads BASE_URL). */
    spec: z.string().min(1),
    serve: Serve,
    timeoutSeconds: z.number().int().positive().default(600),
  }),
]);
export type Gate = z.infer<typeof Gate>;

/** Objective score, 0..100, from an artifact the harness can measure. */
export const ObjectiveScoring = z.discriminatedUnion('type', [
  /** Fraction of passing Playwright tests in `spec`. */
  z.object({
    type: z.literal('playwright-pass-rate'),
    spec: z.string().min(1),
    serve: Serve,
    timeoutSeconds: z.number().int().positive().default(600),
  }),
  /** Fraction of passing `bun test` cases in `spec` against a served HTTP API. */
  z.object({
    type: z.literal('http-contract-pass-rate'),
    spec: z.string().min(1),
    serve: Serve,
    timeoutSeconds: z.number().int().positive().default(600),
  }),
  /** Fraction of passing hidden tests run inside the run dir (bug fixes). */
  z.object({
    type: z.literal('hidden-tests'),
    /** Files copied into the run dir at scoring time, relative to the task directory. */
    files: z.array(z.string().min(1)).min(1),
    run: z.string().min(1),
    timeoutSeconds: z.number().int().positive().default(600),
  }),
  /**
   * Planted-issue recall for planning audits. A judge maps each checklist item to the agent's
   * report; score = recall * 100 - hallucinationPenalty * unsupported findings, floored at 0.
   */
  z.object({
    type: z.literal('checklist'),
    checklist: z.string().min(1),
    /** Output file the agent must write, relative to the run dir. */
    report: z.string().min(1),
    hallucinationPenalty: z.number().min(0).max(100).default(5),
  }),
]);
export type ObjectiveScoring = z.infer<typeof ObjectiveScoring>;

export const RubricDimension = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  label: z.string().min(1),
  weight: z.number().positive(),
});
export type RubricDimension = z.infer<typeof RubricDimension>;

export const SubjectiveScoring = z.object({
  /** Markdown with 0..4 anchors per dimension, shown verbatim to judges. */
  rubric: z.string().min(1),
  dimensions: z.array(RubricDimension).min(1),
  /** Judges also pick winners per pair; aggregated with Bradley-Terry. */
  pairwise: z.boolean().default(false),
  /** What judges see. Screenshots come from `artifacts.screenshots`; `report` is a file in the run dir. */
  evidence: z.array(z.enum(['screenshots', 'diff', 'report', 'transcript-summary'])).min(1),
  /** For `report` evidence: path relative to the run dir. */
  report: z.string().min(1).optional(),
});
export type SubjectiveScoring = z.infer<typeof SubjectiveScoring>;

export const Screenshot = z.object({
  path: z.string().min(1),
  viewports: z.array(Viewport).min(1),
  serve: Serve,
  /** Milliseconds to wait after load before capture (animations, fonts). */
  settleMs: z.number().int().nonnegative().default(500),
});
export type Screenshot = z.infer<typeof Screenshot>;

export const Caps = z.object({
  maxTurns: z.number().int().positive(),
  maxBudgetUsd: z.number().positive(),
  timeboxMinutes: z.number().int().positive(),
});
export type Caps = z.infer<typeof Caps>;

/** `task.yaml`. Paths are relative to the task directory unless stated otherwise. */
export const TaskManifest = z
  .object({
    id: TaskId,
    category: Category,
    title: z.string().min(1),
    summary: z.string().min(1),
    version: z.number().int().positive(),
    authored: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Prompt file handed to the agent verbatim. */
    prompt: z.string().min(1).default('prompt.md'),
    /** Directory copied into a fresh run dir. Git history is never included. */
    fixture: z.string().min(1).optional(),
    caps: Caps,
    gates: z.array(Gate).default([]),
    scoring: z.object({
      objective: ObjectiveScoring.optional(),
      subjective: SubjectiveScoring.optional(),
      /** Weights for combining the two when both exist. */
      weights: z
        .object({ objective: z.number().min(0), subjective: z.number().min(0) })
        .default({ objective: 0.5, subjective: 0.5 }),
    }),
    artifacts: z
      .object({ screenshots: z.array(Screenshot).default([]) })
      .default({ screenshots: [] }),
  })
  .superRefine((task, ctx) => {
    if (task.id.split('/')[0] !== task.category) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: 'id prefix must equal category' });
    }
    if (!task.scoring.objective && !task.scoring.subjective) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring'],
        message: 'a task needs at least one scoring layer',
      });
    }
    const sub = task.scoring.subjective;
    if (sub?.evidence.includes('report') && !sub.report) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring', 'subjective', 'report'],
        message: 'report evidence needs a report path',
      });
    }
  });
export type TaskManifest = z.infer<typeof TaskManifest>;
