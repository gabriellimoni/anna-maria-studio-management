import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as admin from 'firebase-admin';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { UserService } from '../../user/user.service';

jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
}));

const mockUser = {
  id: 'user-1',
  firebaseUid: 'uid-1',
  name: 'Test',
  email: 'test@test.com',
};

const _makeContext = (headers: Record<string, string>, isPublic = false): ExecutionContext => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  (reflector as any)._isPublic = isPublic;

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ headers, user: undefined }),
    }),
  } as unknown as ExecutionContext;
};

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let userService: jest.Mocked<UserService>;
  let verifyIdToken: jest.Mock;

  beforeEach(() => {
    verifyIdToken = jest.fn();
    (admin.auth as jest.Mock).mockReturnValue({ verifyIdToken });

    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    userService = { findOrCreate: jest.fn() } as unknown as jest.Mocked<UserService>;

    guard = new FirebaseAuthGuard(reflector, userService);
  });

  it('allows public routes without token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no token provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    verifyIdToken.mockRejectedValue(new Error('invalid token'));
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer bad-token' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches user to request on valid token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    verifyIdToken.mockResolvedValue({ uid: 'uid-1', name: 'Test', email: 'test@test.com' });
    userService.findOrCreate.mockResolvedValue(mockUser as any);

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toBe(mockUser);
    expect(userService.findOrCreate).toHaveBeenCalledWith('uid-1', { email: 'test@test.com' });
  });
});
