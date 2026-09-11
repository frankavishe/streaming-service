// T017: typed config factory consumed by @nestjs/config. Fails fast (via Joi-free manual checks
// in AppConfigModule) if a required value is missing, rather than letting `undefined` leak into
// runtime code that signs URLs, JWTs, or talks to a payment provider.

export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  s3: {
    endpoint: string;
    publicEndpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
  };
  subscription: {
    periodDays: number;
    priceAmount: number;
    currency: string;
  };
  mpesa: {
    env: string;
    consumerKey: string;
    consumerSecret: string;
    shortcode: string;
    passkey: string;
    callbackUrl: string;
    callbackToken: string;
    stkTimeoutSeconds: number;
  };
  flutterwave: {
    publicKey: string;
    secretKey: string;
    secretHash: string;
    redirectUrl: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? 'streaming-media',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
  subscription: {
    periodDays: parseInt(process.env.SUBSCRIPTION_PERIOD_DAYS ?? '30', 10),
    priceAmount: parseFloat(process.env.SUBSCRIPTION_PRICE_AMOUNT ?? '999'),
    currency: process.env.SUBSCRIPTION_CURRENCY ?? 'KES',
  },
  mpesa: {
    env: process.env.MPESA_ENV ?? 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? '',
    shortcode: process.env.MPESA_SHORTCODE ?? '',
    passkey: process.env.MPESA_PASSKEY ?? '',
    callbackUrl: process.env.MPESA_CALLBACK_URL ?? '',
    callbackToken: process.env.MPESA_CALLBACK_TOKEN ?? '',
    stkTimeoutSeconds: parseInt(process.env.MPESA_STK_TIMEOUT_SECONDS ?? '120', 10),
  },
  flutterwave: {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? '',
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
    secretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? '',
    redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL ?? '',
  },
});
