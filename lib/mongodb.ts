import { MongoClient, Db } from "mongodb";

/**
 * Global MongoDB connection cache for Next.js hot-reloading environments.
 */
let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "bulksms_pakistan";

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!MONGODB_URI) {
    return null;
  }

  if (client) {
    return client;
  }

  if (!clientPromise) {
    const uri = MONGODB_URI;
    const options = {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    };

    if (process.env.NODE_ENV === "development") {
      // In development mode, use a global variable so the MongoClient is not repeated
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };

      if (!globalWithMongo._mongoClientPromise) {
        const newClient = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = newClient.connect();
      }
      clientPromise = globalWithMongo._mongoClientPromise;
    } else {
      const newClient = new MongoClient(uri, options);
      clientPromise = newClient.connect();
    }
  }

  try {
    client = await clientPromise;
    return client;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    clientPromise = null;
    return null;
  }
}

export async function getDatabase(): Promise<Db | null> {
  const c = await getMongoClient();
  if (!c) return null;
  return c.db(DB_NAME);
}

export async function checkMongoHealth(): Promise<{
  connected: boolean;
  dbName?: string;
  error?: string;
}> {
  if (!MONGODB_URI) {
    return {
      connected: false,
      error: "MONGODB_URI is not set in environment or configuration.",
    };
  }

  try {
    const db = await getDatabase();
    if (!db) {
      return { connected: false, error: "Failed to initialize MongoDB client." };
    }
    // Ping database
    await db.command({ ping: 1 });
    return { connected: true, dbName: DB_NAME };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database ping failed";
    return { connected: false, error: msg };
  }
}
