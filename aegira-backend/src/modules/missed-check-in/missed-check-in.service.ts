// MissedCheckIn Service - Business Logic
import type { MissedCheckIn, MissedCheckInStatus } from '@prisma/client';
import { MissedCheckInRepository } from './missed-check-in.repository';
import { AppError } from '../../shared/errors';

/**
 * Valid status transitions:
 * OPEN → INVESTIGATING | EXCUSED | RESOLVED
 * INVESTIGATING → EXCUSED | RESOLVED
 * EXCUSED → (terminal)
 * RESOLVED → (terminal)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['INVESTIGATING', 'EXCUSED', 'RESOLVED'],
  INVESTIGATING: ['EXCUSED', 'RESOLVED'],
  EXCUSED: [],
  RESOLVED: [],
};

export class MissedCheckInService {
  constructor(private readonly repository: MissedCheckInRepository) {}

  async updateStatus(
    id: string,
    newStatus: MissedCheckInStatus,
    userId: string,
    notes?: string
  ): Promise<MissedCheckIn> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError('NOT_FOUND', 'Missed check-in record not found', 404);
    }

    const allowed = VALID_TRANSITIONS[record.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot transition from ${record.status} to ${newStatus}`,
        400
      );
    }

    return this.repository.updateStatus(id, newStatus, {
      notes,
      resolvedBy: userId,
    });
  }
}
