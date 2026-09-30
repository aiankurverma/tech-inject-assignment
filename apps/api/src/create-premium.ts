/**
 * One-off: creates (or resets) a premium customer from NEW_PREMIUM_EMAIL / NEW_PREMIUM_PASSWORD.
 * Run: npm run create-premium -w apps/api
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { Customer } from "./models";

const env = z
  .object({
    MONGODB_URI: z.string(),
    NEW_PREMIUM_EMAIL: z.string().email(),
    NEW_PREMIUM_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

await mongoose.connect(env.MONGODB_URI);
const email = env.NEW_PREMIUM_EMAIL.toLowerCase();
await Customer.updateOne(
  { email },
  { email, name: "Premium Tester", plan: "premium", passwordHash: await bcrypt.hash(env.NEW_PREMIUM_PASSWORD, 12) },
  { upsert: true },
);
console.log(`Premium account ready: ${email}`);
await mongoose.disconnect();
