// One-off script: give every existing User a `username` (= their current
// email) now that doctor/team-member sign-in also supports username+password.
// No passwordHash is set here — these users keep signing in with Google
// until they self-serve a password via the forgot/set-password flow.
//
// Run with: pnpm --filter api backfill:username
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../schemas/user.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  const usersMissingUsername = await userModel
    .find({ username: { $exists: false } })
    .select('_id email')
    .lean();

  console.log(`Found ${usersMissingUsername.length} user(s) without a username.`);

  let updated = 0;
  let skipped = 0;
  for (const user of usersMissingUsername) {
    const username = (user.email || '').toLowerCase().trim();
    if (!username) {
      skipped++;
      continue;
    }

    // Username is globally unique — if another user already holds this
    // email as their username, leave this one for manual follow-up.
    const clash = await userModel.findOne({ username }).select('_id').lean();
    if (clash) {
      console.warn(`Skipping user ${user._id}: username "${username}" already taken by ${clash._id}`);
      skipped++;
      continue;
    }

    await userModel.updateOne({ _id: user._id }, { $set: { username } });
    updated++;
  }

  console.log(`Backfill complete. Updated ${updated}, skipped ${skipped}.`);
  await app.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
