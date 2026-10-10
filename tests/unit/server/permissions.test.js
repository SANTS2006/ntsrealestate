import { describe, it, expect } from 'vitest';
import { PERMISSIONS, DEFAULT_ROLE_TEMPLATES } from '../../../server/src/constants/permissions.js';

describe('permission catalog integrity', () => {
  const catalogNames = new Set(PERMISSIONS.map((p) => p.name));

  it('has no duplicate permission names', () => {
    expect(catalogNames.size).toBe(PERMISSIONS.length);
  });

  // Guards the exact failure mode role.service.js's bootstrap comment warns
  // about: a role template referencing a permission name that doesn't exist
  // in the catalog silently grants nothing for that entry instead of erroring.
  for (const [roleName, template] of Object.entries(DEFAULT_ROLE_TEMPLATES)) {
    it(`every permission referenced by the "${roleName}" role template exists in the catalog`, () => {
      const missing = template.permissions.filter((name) => !catalogNames.has(name));
      expect(missing).toEqual([]);
    });
  }

  it('the administrator role template grants the entire permission catalog', () => {
    expect(new Set(DEFAULT_ROLE_TEMPLATES.administrator.permissions)).toEqual(catalogNames);
  });

  it('the auditor role template is read-only apart from viewing documents and writing audit remarks', () => {
    const nonRead = DEFAULT_ROLE_TEMPLATES.auditor.permissions.filter((name) => !name.endsWith(':read') && !['documents:download', 'audit-remarks:create'].includes(name));
    expect(nonRead).toEqual([]);
  });
});
