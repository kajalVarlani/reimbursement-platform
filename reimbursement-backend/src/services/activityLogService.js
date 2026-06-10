/**
 * activityLogService.js
 *
 * Shared helper to write an ActivityLog entry.
 * Pass `tx` (a Prisma transaction client) to run inside a transaction,
 * or omit it to use the global Prisma client.
 */

const prisma = require("../prisma/client");

/**
 * @param {object} params
 * @param {string}  params.reimbursementId
 * @param {import("@prisma/client").ActivityAction} params.action
 * @param {string}  [params.activity]        - free-form remark / description
 * @param {"USER"|"ADMINISTRATOR"} params.actorType
 * @param {string}  [params.userId]          - required when actorType = "USER"
 * @param {string}  [params.administratorId] - required when actorType = "ADMINISTRATOR"
 * @param {string}  params.actorRole         - role string at time of action
 * @param {object}  [tx]                     - optional Prisma transaction client
 */
async function logActivity(params, tx) {
  const client = tx || prisma;

  const {
    reimbursementId,
    action,
    activity,
    actorType,
    userId,
    administratorId,
    actorRole,
  } = params;

  return client.activityLog.create({
    data: {
      reimbursementId,
      action,
      activity: activity ?? null,
      actorType,
      userId: userId ?? null,
      administratorId: administratorId ?? null,
      actorRole,
    },
  });
}

module.exports = { logActivity };
