export const appConfig = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'stsk-dev-secret',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/stsk',
};
