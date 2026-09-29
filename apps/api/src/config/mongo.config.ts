import { MongooseModuleOptions } from '@nestjs/mongoose';

export const mongoConfig = (): MongooseModuleOptions => ({
  uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/stsk',
});
