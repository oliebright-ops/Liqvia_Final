import {
  canAccessRoute,
  getDefaultAppPath,
  hasFullAccess,
  hasPermission,
} from './permissions';

describe('permissions', () => {
  it('grants full access only to owner and admin', () => {
    expect(hasFullAccess('owner')).toBe(true);
    expect(hasFullAccess('admin')).toBe(true);
    expect(hasFullAccess('member')).toBe(false);
    expect(hasFullAccess('uploader')).toBe(false);
  });

  it('restricts uploader to uploads only', () => {
    expect(hasPermission('uploader', 'uploads:read')).toBe(true);
    expect(hasPermission('uploader', 'uploads:write')).toBe(true);
    expect(hasPermission('uploader', 'treasury:read')).toBe(false);
    expect(hasPermission('uploader', 'settings:profile')).toBe(false);
    expect(canAccessRoute('uploader', '/uploads')).toBe(true);
    expect(canAccessRoute('uploader', '/dashboard')).toBe(false);
    expect(getDefaultAppPath('uploader')).toBe('/uploads');
  });

  it('allows member to read treasury but not upload or manage settings', () => {
    expect(hasPermission('member', 'treasury:read')).toBe(true);
    expect(hasPermission('member', 'uploads:write')).toBe(false);
    expect(hasPermission('member', 'settings:admin')).toBe(false);
    expect(hasPermission('member', 'scenarios:write')).toBe(true);
  });
});
