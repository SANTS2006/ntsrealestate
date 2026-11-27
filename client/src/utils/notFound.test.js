import { describe, it, expect } from 'vitest';
import { classifyPath } from './notFound.js';

describe('classifyPath', () => {
  it('sends unknown platform console pages to the platform 404', () => {
    expect(classifyPath('/platform-admin/nope')).toEqual({ area: 'platform' });
  });

  it('recognises the app\'s own sections, so they are never read as a company', () => {
    expect(classifyPath('/dashboard/nope')).toEqual({ area: 'app' });
    expect(classifyPath('/properties/1/extra')).toEqual({ area: 'app' });
  });

  it('reads any other first segment as a company URL name', () => {
    expect(classifyPath('/acme-realty')).toEqual({ area: 'company', slug: 'acme-realty' });
    expect(classifyPath('/Acme-Realty/nope/deeper')).toEqual({ area: 'company', slug: 'acme-realty' });
  });

  it('never treats something that cannot be a company name as one', () => {
    expect(classifyPath('/wp-login.php')).toEqual({ area: 'main' });
    expect(classifyPath('/%2e%2e/etc')).toEqual({ area: 'main' });
    expect(classifyPath('/')).toEqual({ area: 'main' });
  });
});
