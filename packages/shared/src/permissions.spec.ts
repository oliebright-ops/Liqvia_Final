import {
  ACCESS_GUIDE_ROLES,
  canAccessRoute,
  getDefaultAppPath,
  getRoleAccessLevels,
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
    expect(hasPermission('uploader', 'uploads:write')).toBe(true);
    expect(hasPermission('uploader', 'treasury:read')).toBe(false);
    expect(canAccessRoute('uploader', '/uploads')).toBe(true);
    expect(canAccessRoute('uploader', '/dashboard')).toBe(false);
    expect(getDefaultAppPath('uploader')).toBe('/uploads');
    expect(getRoleAccessLevels('uploader').treasury).toBe('none');
    expect(getRoleAccessLevels('uploader').uploads).toBe('edit');
  });

  it('allows member to review treasury, upload data, and run scenarios', () => {
    expect(hasPermission('member', 'treasury:read')).toBe(true);
    expect(hasPermission('member', 'uploads:write')).toBe(true);
    expect(hasPermission('member', 'settings:admin')).toBe(false);
    expect(hasPermission('member', 'scenarios:write')).toBe(true);
    expect(getRoleAccessLevels('member').uploads).toBe('edit');
    expect(getRoleAccessLevels('member').administration).toBe('view');
  });

  it('keeps viewer read-only except AI chat', () => {
    expect(hasPermission('viewer', 'uploads:write')).toBe(false);
    expect(hasPermission('viewer', 'scenarios:write')).toBe(false);
    expect(getRoleAccessLevels('viewer').uploads).toBe('view');
    expect(getRoleAccessLevels('viewer').scenarios).toBe('view');
  });

  it('documents all roles in the access guide', () => {
    expect(ACCESS_GUIDE_ROLES).toContain('owner');
    expect(ACCESS_GUIDE_ROLES).toContain('uploader');
  });
});
