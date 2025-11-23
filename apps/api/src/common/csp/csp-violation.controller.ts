import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';

/**
 * CSP Violation Report structure
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_report_syntax
 */
interface CSPViolation {
  'csp-report': {
    'document-uri': string;
    referrer: string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    disposition: string;
    'blocked-uri': string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
    'script-sample'?: string;
  };
}

/**
 * CSP Violation Reporting Controller
 * 
 * Receives and logs Content Security Policy violation reports from browsers.
 * This endpoint is public to allow browsers to send violation reports without authentication.
 * 
 * Security Note: This endpoint logs violations for monitoring but does not store them in the database
 * to avoid potential DoS attacks from malicious clients sending fake violation reports.
 */
@ApiTags('security')
@Controller('csp-violations')
export class CSPViolationController {
  private readonly logger = new Logger(CSPViolationController.name);

  @Post()
  @HttpCode(204)
  @Public() // Must be public to receive reports from browsers
  @ApiOperation({
    summary: 'Report CSP violation',
    description: 'Endpoint for browsers to report Content Security Policy violations',
  })
  @ApiResponse({
    status: 204,
    description: 'Violation report received successfully',
  })
  async reportViolation(@Body() violation: CSPViolation) {
    const report = violation['csp-report'];
    
    // Log violation with structured data for monitoring
    this.logger.warn('CSP Violation detected', {
      directive: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      blockedUri: report['blocked-uri'],
      documentUri: report['document-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      disposition: report.disposition,
    });

    // Optional: Store in database for analysis (commented out for MVP)
    // In production, consider rate limiting this endpoint and storing violations
    // await this.prisma.cspViolation.create({
    //   data: {
    //     violatedDirective: report['violated-directive'],
    //     blockedUri: report['blocked-uri'],
    //     documentUri: report['document-uri'],
    //     sourceFile: report['source-file'],
    //     lineNumber: report['line-number'],
    //   },
    // });

    // Return 204 No Content - standard response for CSP violation reports
    return;
  }
}
