import { buildPaginationMeta } from '../utils/pagination.js';
import { createAuditRemark, findAuditRemarksByOrganization, countAuditRemarksByOrganization } from '../repositories/auditRemark.repository.js';
import { findUserById, findUserIdsByRole } from '../repositories/user.repository.js';
import { notify } from './notification.service.js';

function serializeAuditRemark(remark) {
  return {
    id: remark.id,
    content: remark.content,
    createdAt: remark.createdAt,
    author: remark.author
      ? { id: remark.author.id, firstName: remark.author.firstName, lastName: remark.author.lastName, email: remark.author.email }
      : null,
  };
}

export async function createRemark(organizationId, actingUser, content) {
  const remark = await createAuditRemark({ organizationId, authorId: actingUser.id, content });

  const admins = await findUserIdsByRole(organizationId, 'administrator');
  const otherAdmins = admins.filter((admin) => admin.id !== actingUser.id);
  if (otherAdmins.length > 0) {
    const author = await findUserById(actingUser.id, organizationId);
    const authorName = author ? `${author.firstName} ${author.lastName}` : 'A reviewer';
    for (const admin of otherAdmins) {
      await notify({
        organizationId, userId: admin.id, type: 'audit_remark_created',
        title: 'New audit remark', message: `${authorName} left a new audit remark.`,
      });
    }
  }

  return serializeAuditRemark(remark);
}

export async function listRemarks(organizationId, { page, pageSize, skip, take }) {
  const [remarks, total] = await Promise.all([
    findAuditRemarksByOrganization(organizationId, { skip, take }),
    countAuditRemarksByOrganization(organizationId),
  ]);
  return { remarks: remarks.map(serializeAuditRemark), meta: buildPaginationMeta({ page, pageSize, total }) };
}
