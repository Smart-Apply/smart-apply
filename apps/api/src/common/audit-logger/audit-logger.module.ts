import { Module, Global } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';

@Global()
@Module({
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditLoggerModule {}
