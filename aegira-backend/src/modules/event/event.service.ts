// Event Service - Centralized event creation with time tracking
// Phase 1: Adds event_time, ingested_at, event_timezone, and late detection

import type { Event, EventType, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { logger } from '../../config/logger';

export interface CreateEventInput {
  companyId: string;
  personId?: string;
  eventType: EventType;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  timezone: string;
  scheduleWindow?: { start: string; end: string };
}

interface LateDetectionResult {
  isLate: boolean;
  lateByMinutes: number | null;
}

/**
 * Detect if current time is past the schedule window end.
 * Only applies when a scheduleWindow is provided.
 */
function detectLateSubmission(
  currentTimeHHmm: string,
  scheduleWindow?: { start: string; end: string }
): LateDetectionResult {
  if (!scheduleWindow) {
    return { isLate: false, lateByMinutes: null };
  }

  if (currentTimeHHmm <= scheduleWindow.end) {
    return { isLate: false, lateByMinutes: null };
  }

  // Calculate minutes past window end
  const endParts = scheduleWindow.end.split(':').map(Number);
  const curParts = currentTimeHHmm.split(':').map(Number);
  const endMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
  const curMinutes = (curParts[0] ?? 0) * 60 + (curParts[1] ?? 0);
  const lateByMinutes = curMinutes - endMinutes;

  return { isLate: true, lateByMinutes };
}

/**
 * Build the data object for creating an Event record.
 * Separated from DB call to support both standalone and transaction usage.
 */
export function buildEventData(input: CreateEventInput): Prisma.EventUncheckedCreateInput {
  const now = DateTime.now().setZone(input.timezone);
  const eventTime = now.toJSDate();
  const ingestedAt = new Date(); // UTC server time
  const currentTimeHHmm = now.toFormat('HH:mm');

  const { isLate, lateByMinutes } = detectLateSubmission(
    currentTimeHHmm,
    input.scheduleWindow
  );

  return {
    company_id: input.companyId,
    person_id: input.personId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    payload: input.payload as Prisma.InputJsonValue,
    event_time: eventTime,
    ingested_at: ingestedAt,
    event_timezone: input.timezone,
    is_late: isLate,
    late_by_minutes: lateByMinutes,
  };
}

/**
 * Create an event record with automatic time tracking and late detection.
 *
 * For standalone use (not inside a transaction). If you need to create
 * an event inside a transaction, use `buildEventData()` + `tx.event.create()`.
 */
async function createEvent(
  prisma: PrismaClient,
  input: CreateEventInput
): Promise<Event> {
  const data = buildEventData(input);
  return prisma.event.create({ data });
}

/**
 * Fire-and-forget event creation. Logs errors but never throws.
 * Use for non-critical event emissions (e.g., missed check-in detection events).
 */
export function emitEvent(
  prisma: PrismaClient,
  input: CreateEventInput
): void {
  createEvent(prisma, input).catch((err) => {
    logger.error(
      { err, eventType: input.eventType, entityType: input.entityType },
      'Failed to emit event'
    );
  });
}
