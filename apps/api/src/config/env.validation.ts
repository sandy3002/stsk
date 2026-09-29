import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  PORT = 3001;

  @IsString()
  JWT_SECRET = 'stsk-dev-secret';

  @IsString()
  MONGO_URI = 'mongodb://localhost:27017/stsk';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors.map((error) => error.toString()).join(', ')}`,
    );
  }

  return validatedConfig;
}
