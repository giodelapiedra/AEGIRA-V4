// Transfer Processor Job
// Runs every 15 minutes. Processes pending team transfers
// whose effective date has arrived.

import { prisma } from '../config/database';
import { PersonRepository } from '../modules/person/person.repository';
import { sendNotification } from '../modules/notification/notification.service';
import { emitEvent } from '../modules/event/event.service';
import { logger } from '../config/logger';
import { getTodayInTimezone, parseDateInTimezone } from '../shared/utils';

let isRunning = false;

export async function processTransfers(): Promise<void> {
  if (isRunning) {
    logger.info('Skipping transfer processing: previous run still in progress');
    return;
  }

  isRunning = true;

  try {
    const companies = await prisma.company.findMany({
      where: { is_active: true },
      select: { id: true, timezone: true },
    });

    let totalProcessed = 0;

    for (const company of companies) {
      try {
        const processed = await processCompanyTransfers(company.id, company.timezone);
        totalProcessed += processed;
      } catch (error) {
        logger.error({ error, companyId: company.id }, 'Failed to process transfers for company');
      }
    }

    if (totalProcessed > 0) {
      logger.info({ totalProcessed }, 'Transfer processing completed');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run transfer processing');
    throw error;
  } finally {
    isRunning = false;
  }
}

async function processCompanyTransfers(companyId: string, timezone: string): Promise<number> {
  const todayStr = getTodayInTimezone(timezone);
  const todayDate = parseDateInTimezone(todayStr, timezone);

  const personRepo = new PersonRepository(prisma, companyId);
  const pendingTransfers = await personRepo.findPendingTransfers(todayDate);

  if (pendingTransfers.length === 0) return 0;

  let processed = 0;

  for (const transfer of pendingTransfers) {
    try {
      if (!transfer.effective_team_id) {
        logger.warn({ personId: transfer.id }, 'Skipping transfer: no effective_team_id');
        continue;
      }

      // Skip if target team has been deactivated — cancel the transfer instead
      if (transfer.effective_team && !transfer.effective_team.is_active) {
        logger.warn(
          { personId: transfer.id, targetTeamId: transfer.effective_team_id },
          'Cancelling transfer: target team is inactive'
        );
        await personRepo.cancelTransfer(transfer.id);

        // Emit cancel event (fire-and-forget)
        emitEvent(prisma, {
          companyId,
          personId: transfer.id,
          eventType: 'TEAM_TRANSFER_CANCELLED',
          entityType: 'person',
          entityId: transfer.id,
          payload: {
            cancelledTransferTo: transfer.effective_team_id,
            reason: 'target_team_inactive',
          },
          timezone,
        });

        sendNotification(prisma, companyId, {
          personId: transfer.id,
          type: 'TEAM_ALERT',
          title: 'Transfer Cancelled',
          message: `Your transfer to ${transfer.effective_team.name} was cancelled because the team is no longer active.`,
        });

        continue;
      }

      await personRepo.executeTransfer(
        transfer.id,
        transfer.effective_team_id,
        todayDate
      );

      processed++;

      // Send welcome notification (fire-and-forget)
      const teamName = transfer.effective_team?.name ?? 'your new team';
      sendNotification(prisma, companyId, {
        personId: transfer.id,
        type: 'TEAM_ALERT',
        title: `Welcome to ${teamName}!`,
        message: 'Your transfer is complete. Your first check-in starts on your next scheduled work day.',
      });

      // Emit event (fire-and-forget)
      emitEvent(prisma, {
        companyId,
        personId: transfer.id,
        eventType: 'TEAM_TRANSFER_COMPLETED',
        entityType: 'person',
        entityId: transfer.id,
        payload: {
          newTeamId: transfer.effective_team_id,
          newTeamName: teamName,
          effectiveDate: todayStr,
        },
        timezone,
      });

      logger.info(
        { personId: transfer.id, newTeamId: transfer.effective_team_id, companyId },
        'Transfer completed'
      );
    } catch (error) {
      logger.error({ error, personId: transfer.id }, 'Failed to execute transfer');
    }
  }

  return processed;
}
