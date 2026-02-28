import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export async function connectInMemoryMongo(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.PEOPLEPORTAL_MONGO_URL = mongoUri;

  await mongoose.connect(mongoUri);
}

export async function clearInMemoryMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

export async function disconnectInMemoryMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}
