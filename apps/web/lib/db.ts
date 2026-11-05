import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongoose || { conn: null, promise: null };

if (!global._mongoose) {
  global._mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'Missing MONGODB_URI (or MONGO_URI) environment variable. Please set it in your environment or .env file.'
    );
  }

  // SWARM-CONC-004: Validate readyState === 1 (connected).
  // If connection dropped or is disconnected, invalidate cache and reconnect.
  if (cached.conn && cached.conn.connection?.readyState === 1) {
    return cached.conn;
  }

  // If connection was disconnected or closed, clean up stale reference
  if (cached.conn && cached.conn.connection?.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
