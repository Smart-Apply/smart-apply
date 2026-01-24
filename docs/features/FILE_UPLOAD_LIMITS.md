# File Upload Limits Implementation

## Overview

Configurable file size limits prevent resource exhaustion (OOM crashes, storage overflow, Azure Blob cost explosion) by validating files **before** processing and upload.

## Implementation

### Environment Variables

Added to `apps/api/src/config/env.schema.ts`:

```bash
# File Upload Limits (in MB)
MAX_FILE_SIZE_MB=10              # Max size for job posting files (PDF/DOCX)
MAX_PROFILE_PHOTO_SIZE_MB=5      # Max size for profile photos (reserved for future use)
```

**Defaults:**

- Job posting files: 10 MB
- Profile photos: 5 MB (not yet implemented)

**Configuration:**

- Development: Set in `.env` or `.env.local`
- Testing: Set in `.env.test` (already configured)
- Production: Set via Azure Key Vault or environment variables

### Controller-Level Validation

`apps/api/src/uploads/uploads.controller.ts` now uses `ParseFilePipe` with validators:

```typescript
@UploadedFile(
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({
        maxSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024,
        message: 'File size exceeds 10MB limit. Please compress or split your file.',
      }),
      new FileTypeValidator({
        fileType: /(pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
      }),
    ],
    fileIsRequired: true,
  }),
)
file: Express.Multer.File
```

**Benefits:**

- ✅ **Early rejection** - Files rejected at controller level before entering business logic
- ✅ **Memory efficiency** - Never loads oversized files into memory
- ✅ **User-friendly errors** - Clear error messages with actionable guidance
- ✅ **Configurable** - Adjust limits via environment variables

### Service-Level Validation

`apps/api/src/uploads/uploads.service.ts` validates as a **defense-in-depth** layer:

```typescript
constructor(
  private readonly storageService: StorageService,
  private readonly configService: ConfigService,
) {
  const maxSizeMB = parseInt(
    this.configService.get<string>('MAX_FILE_SIZE_MB', '10'),
    10,
  );
  this.MAX_FILE_SIZE = maxSizeMB * 1024 * 1024;
  this.logger.log(`Max file size configured: ${maxSizeMB}MB`);
}
```

**Validation checks:**

1. File exists
2. MIME type whitelist (PDF, DOCX)
3. File size < MAX_FILE_SIZE
4. Filename sanitization (path traversal protection)

### API Documentation

Updated Swagger docs (`/api/v1/uploads` endpoint):

```yaml
/api/v1/uploads:
  post:
    summary: Upload a file (PDF or DOCX)
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            properties:
              file:
                type: string
                format: binary
                description: File to upload (PDF or DOCX, max 10MB)
    responses:
      '400':
        description: File size exceeds 10MB limit, invalid file type, or no file provided
```

## Testing

### Unit Tests

`apps/api/src/uploads/uploads.service.spec.ts`:

```bash
✓ should upload a PDF file successfully
✓ should upload a DOCX file successfully
✓ should throw BadRequestException when no file is provided
✓ should throw BadRequestException for invalid MIME type
✓ should throw BadRequestException for file size exceeding limit (11MB file)
✓ should sanitize dangerous filenames
✓ should replace unsafe characters in filename
✓ should handle storage service errors
```

**Run:**

```bash
cd apps/api
npx jest src/uploads/uploads.service.spec.ts
```

### E2E Tests

`apps/api/test/e2e/features/uploads.e2e-spec.ts`:

```bash
✓ should upload a PDF file successfully
✓ should upload a DOCX file successfully
✓ should reject upload without authentication
✓ should reject upload without file
✓ should reject file larger than 10MB (6MB large-file.pdf fixture)
✓ should reject unsupported file type (text/plain)
✓ should sanitize dangerous filenames (path traversal protection)
```

**Run:**

```bash
cd apps/api
npm run test:e2e -- --testPathPattern=uploads
```

## Error Messages

### File Too Large (Service-level)

```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit. Your file is 15.50MB. Please compress or split your file.",
  "error": "Bad Request"
}
```

### File Too Large (Controller-level)

```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit. Please compress or split your file.",
  "error": "Bad Request"
}
```

### Invalid File Type

```json
{
  "statusCode": 400,
  "message": "Invalid file type. Allowed types: PDF, DOCX. Received: text/plain",
  "error": "Bad Request"
}
```

## Security Considerations

### Defense-in-Depth

1. **Controller validation** (ParseFilePipe) - First line of defense, rejects before processing
2. **Service validation** (UploadsService) - Backup validation with detailed logging
3. **MIME type whitelist** - Only PDF and DOCX allowed
4. **Filename sanitization** - Path traversal protection (`../../../etc/passwd` → `etc_passwd`)

### Resource Protection

- **OOM Prevention** - Files > 10MB rejected before loading into memory
- **Storage Protection** - Prevents multi-GB uploads to Azure Blob
- **Cost Control** - Limits Azure Blob Storage costs
- **Network Protection** - Early rejection saves bandwidth

## Future Enhancements

1. **Profile Photo Upload** - Use `MAX_PROFILE_PHOTO_SIZE_MB` environment variable
2. **Different Limits per Endpoint** - Separate limits for different file types
3. **Virus Scanning** - Integrate ClamAV or Azure Defender for scanning uploads
4. **File Compression** - Auto-compress large PDFs before storage
5. **Progress Tracking** - Show upload progress for large files (client-side)

## Related Files

- `apps/api/src/config/env.schema.ts` - Environment variable schema
- `apps/api/src/uploads/uploads.controller.ts` - Controller-level validation
- `apps/api/src/uploads/uploads.service.ts` - Service-level validation
- `apps/api/src/uploads/uploads.service.spec.ts` - Unit tests
- `apps/api/test/e2e/features/uploads.e2e-spec.ts` - E2E tests
- `apps/api/.env.test` - Test environment configuration

## Deployment Checklist

- [ ] Set `MAX_FILE_SIZE_MB` in production environment (Azure Key Vault or App Service env vars)
- [ ] Monitor Azure Blob Storage costs after deployment
- [ ] Set up alerts for failed upload attempts (rate > 10% indicates UX issue)
- [ ] Review logs for file size rejections to validate limit appropriateness
- [ ] Update frontend to show file size limit in upload UI

## Monitoring

Monitor these metrics post-deployment:

- **Upload Success Rate**: Should be > 95% (failures indicate limit too low)
- **File Size Distribution**: P50, P95, P99 file sizes
- **Rejection Rate**: Files rejected due to size (should be < 5%)
- **Storage Growth**: Azure Blob Storage usage over time
- **Error Rate**: 400 errors from uploads endpoint

Query logs:

```bash
# Count rejections by reason
grep "File size exceeds" /var/log/api.log | wc -l
grep "Invalid file type" /var/log/api.log | wc -l

# Average file size
grep "File uploaded successfully" /var/log/api.log | awk '{print $NF}' | datamash mean 1
```
