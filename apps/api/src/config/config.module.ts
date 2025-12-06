import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import { validateEnv } from './env.schema';
import { ConfigService } from './config.service';

// __dirname in dist: /Users/arian/VS-Projects/smart-apply/dist/apps/api/config
// .env location: /Users/arian/VS-Projects/smart-apply/apps/api/.env
// Need to go up 4 levels from dist to root, then down to apps/api/.env
const envPath = join(__dirname, '../../../../apps/api/.env');
console.log('🔍 Looking for .env file at:', envPath);
console.log('🔍 __dirname is:', __dirname);

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envPath,
      validate: validateEnv,
      cache: true,
      ignoreEnvFile: false,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
