// apps/api/src/trpc/middleware/rbac.middleware.test.ts

import { TRPCError } from '@trpc/server';
import { enforceRbac } from './rbac.middleware';
import { hasPermission, Permission, Role } from '../../config/permissions';

// Mock the tRPC init module to control `t.middleware`
jest.mock('../init', () => ({
  t: {
    middleware: jest.fn((fn) => fn), // Mock t.middleware to just return the passed function
  },
}));

// Mock the hasPermission helper
jest.mock('../../config/permissions', () => ({
  hasPermission: jest.fn(),
  PERMISSIONS: {
    owner: ['brand:delete', 'brand:update'],
    member: ['brand:read'],
  },
}));

describe('enforceRbac middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw UNAUTHORIZED if user is not authenticated', async () => {
    const middlewareFn = enforceRbac('brand:delete' as Permission);
    const ctx = { user: null };
    const next = jest.fn();

    await expect(middlewareFn({ ctx, next })).rejects.toThrow(
      new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw FORBIDDEN if user has no role', async () => {
    const middlewareFn = enforceRbac('brand:delete' as Permission);
    const ctx = { user: { id: '123', email: 'test@example.com', role: undefined } }; // No role
    const next = jest.fn();

    (hasPermission as jest.Mock).mockReturnValue(false);

    await expect(middlewareFn({ ctx, next })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw FORBIDDEN if user lacks required permission', async () => {
    const middlewareFn = enforceRbac('brand:delete' as Permission);
    const ctx = { user: { id: '123', email: 'test@example.com', role: 'member' as Role } };
    const next = jest.fn();

    (hasPermission as jest.Mock).mockReturnValue(false);

    await expect(middlewareFn({ ctx, next })).rejects.toThrow(
      new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' })
    );
    expect(hasPermission).toHaveBeenCalledWith('member', 'brand:delete');
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if user has required permission', async () => {
    const middlewareFn = enforceRbac('brand:delete' as Permission);
    const ctx = { user: { id: '123', email: 'test@example.com', role: 'owner' as Role } };
    const next = jest.fn(() => ({ ctx })); // Mock next to return ctx

    (hasPermission as jest.Mock).mockReturnValue(true);

    await expect(middlewareFn({ ctx, next })).resolves.toEqual({ ctx });
    expect(hasPermission).toHaveBeenCalledWith('owner', 'brand:delete');
    expect(next).toHaveBeenCalledTimes(1);
  });
});