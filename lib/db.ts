import mongoose from "mongoose";
import "@/models"; // Register all models globally

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as unknown as { mongoose: { conn: mongoose.Mongoose | null; promise: Promise<typeof mongoose> | null } }).mongoose;

if (!cached) {
  cached = (global as unknown as { mongoose: { conn: mongoose.Mongoose | null; promise: Promise<mongoose.Mongoose> | null } }).mongoose = { conn: null, promise: null };
}

async function connectDB() {

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      tls: true,
    };

    console.log("Connecting to MongoDB Platform...");
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      console.log("Successfully connected to MongoDB");
      return mongoose;
    }).catch(err => {
      console.error("MongoDB Connection Failed!");
      if (err.message.includes("SSL") || err.message.includes("TLS") || err.code === 80) {
        console.error("--- SSL/TLS DIAGNOSTIC ---");
        console.error("The connection was rejected during the TLS handshake (Alert 80).");
        console.error("This is likely due to your IP address not being in the MongoDB Atlas IP Access List.");
        console.error("Action: Please check your Atlas dashboard -> Network Access -> IP Access List.");
        console.error("-------------------------");
      }
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    // The specific SSL error log is handled in the .catch above
    throw e;
  }

  return cached.conn;
}

export default connectDB;
