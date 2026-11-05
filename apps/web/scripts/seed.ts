import fs from 'fs';
import path from 'path';

// Native env loader
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/web/.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val.replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  }
}

loadEnv();

import { connectDB } from '../lib/db';
import { User } from '../lib/models/user';
import { hashPassword } from '../lib/auth';

export async function seedAdminUser() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD || 'ChangeThisToAStrongPassword123';

  console.log(`[Seed] Connecting to MongoDB...`);
  await connectDB();

  console.log(`[Seed] Syncing admin user: "${username}"...`);
  const passwordHash = await hashPassword(password);

  try {
    const user = await User.findOneAndUpdate(
      { username },
      { $set: { passwordHash, role: 'admin' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Seed] Successfully updated credentials for admin user: "${username}".`);
    return user;
  } catch (err: any) {
    if (err?.code === 11000) {
      const user = await User.findOneAndUpdate(
        { username },
        { $set: { passwordHash, role: 'admin' } },
        { new: true }
      );
      console.log(`[Seed] Successfully updated credentials for admin user: "${username}".`);
      return user;
    }
    throw err;
  }
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  seedAdminUser()
    .then(() => {
      console.log('[Seed] Seeding completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Seed] Seeding failed:', error);
      process.exit(1);
    });
}
