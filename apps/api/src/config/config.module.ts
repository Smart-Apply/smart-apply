import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateEnv } from './env.schema';
import { ConfigService } from './config.service';

// __dirname in dist: /Users/arian/VS-Projects/smart-apply/dist/apps/api/config
// .env location:    /Users/arian/VS-Projects/smart-apply/apps/api/.env
// Need to go up 4 levels from dist to root, then down to apps/api/.env
const apiRoot = join(__dirname, '../../../../apps/api');
const baseEnv = join(apiRoot, '.env');

// Logical stage selector. Defaults to 'local' so existing flows keep working.
// Override per shell: `APP_ENV=int npm run start:dev`
const appEnv = (process.env.APP_ENV ?? 'local').toLowerCase();
const stageEnv = join(apiRoot, `.env.${appEnv}`);

// Nest's ConfigModule uses the FIRST matching key across the array — so the
// stage-specific file overrides the shared base. Missing files are silently
// skipped by dotenv, but we filter to keep startup logs clean.
const envFilePath = [stageEnv, baseEnv].filter((p) => existsSync(p));

if (process.env.NODE_ENV === 'development') {
  console.log(`[ConfigModule] APP_ENV=${appEnv} — loading:`, envFilePath);
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validate: validateEnv,
      cache: true,
      ignoreEnvFile: false,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
