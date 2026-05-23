import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { User } from './user.entity';

const mockUser = (): User => ({
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  email: 'john@example.com',
  role: 'operator',
  isActive: true,
  studentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
    }).compile();

    controller = module.get(UserController);
  });

  it('getMe returns current user', () => {
    const user = mockUser();
    expect(controller.getMe(user)).toBe(user);
  });
});
