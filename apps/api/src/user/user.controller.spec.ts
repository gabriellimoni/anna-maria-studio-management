import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';

const mockUser = (): User => ({
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: { update: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  it('getMe returns current user', () => {
    const user = mockUser();
    expect(controller.getMe(user)).toBe(user);
  });

  it('updateMe calls service.update with user id', async () => {
    const user = mockUser();
    const updated = { ...user, name: 'New Name' };
    service.update.mockResolvedValue(updated);

    const result = await controller.updateMe(user, { name: 'New Name' });

    expect(service.update).toHaveBeenCalledWith('user-1', { name: 'New Name' });
    expect(result).toBe(updated);
  });
});
