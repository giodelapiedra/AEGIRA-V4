// Environment Configuration with Zod Validation
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // Cloudflare R2 Storage (defaults for dev, validated for production below)
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default('aegira-profiles'),
  R2_PUBLIC_URL: z.string().default('https://placeholder.r2.dev'),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      return data.R2_ACCOUNT_ID.length > 0
        && data.R2_ACCESS_KEY_ID.length > 0
        && data.R2_SECRET_ACCESS_KEY.length > 0;
    }
    return true;
  },
  { message: 'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required in production' }
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
