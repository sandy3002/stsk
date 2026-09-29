import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const usersService = {
      findByUsername: async (username: string) => {
        const users: Record<
          string,
          {
            _id: string;
            username: string;
            passwordHash: string;
            role: 'admin' | 'viewer';
          }
        > = {
          admin: {
            _id: 'admin-id',
            username: 'admin',
            passwordHash:
              '$2b$10$F3DjPo1JP0h8CQIn5VKH5OxtHi/0MiX8CWSmSMsZ43xx9CoH4VXda',
            role: 'admin',
          },
          viewer: {
            _id: 'viewer-id',
            username: 'viewer',
            passwordHash:
              '$2b$10$jFJq483kV5Gr7crscumRVO0L9mPZViyUS32B5c/2IjOXtXz1xluY6',
            role: 'viewer',
          },
        };

        return users[username.toLowerCase().trim()] ?? null;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('validates the seeded admin account', async () => {
    const result = await service.validateUser('admin', 'admin123');
    expect(result?.role).toBe('admin');
    expect(result?.username).toBe('admin');
  });

  it('rejects a bad password', async () => {
    const result = await service.validateUser('viewer', 'wrong-password');
    expect(result).toBeNull();
  });
});
