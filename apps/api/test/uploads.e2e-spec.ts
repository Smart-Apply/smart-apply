import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import * as path from 'path';
import * as fs from 'fs';

describe('UploadsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  const testPdfPath = path.join(__dirname, 'fixtures', 'test-resume.pdf');
  const testDocxPath = path.join(__dirname, 'fixtures', 'test-resume.docx');
  const largeFilePath = path.join(__dirname, 'fixtures', 'large-file.pdf');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@smartapply.com',
        password: 'Demo123!',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
    userId = loginResponse.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/uploads', () => {
    it('should upload a PDF file successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testPdfPath)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('fileName');
      expect(response.body).toHaveProperty('mimeType', 'application/pdf');
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('storageKey');
      expect(response.body).toHaveProperty('uploadedAt');
      expect(response.body.fileName).toContain('test-resume.pdf');
      expect(response.body.storageKey).toContain(userId);
    });

    it('should upload a DOCX file successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testDocxPath)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(response.body.fileName).toContain('test-resume.docx');
    });

    it('should reject upload without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .attach('file', testPdfPath)
        .expect(401);
    });

    it('should reject upload without file', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject file larger than 5MB', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeFilePath)
        .expect(400);

      expect(response.body.message).toContain('File too large');
    });

    it('should reject unsupported file type', async () => {
      // Create a temporary text file
      const txtFilePath = path.join(__dirname, 'fixtures', 'test.txt');
      fs.writeFileSync(txtFilePath, 'This is a test file');

      try {
        const response = await request(app.getHttpServer())
          .post('/api/v1/uploads')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', txtFilePath)
          .expect(400);

        expect(response.body.message).toContain('Invalid file type');
      } finally {
        // Cleanup
        if (fs.existsSync(txtFilePath)) {
          fs.unlinkSync(txtFilePath);
        }
      }
    });

    it('should sanitize dangerous filenames', async () => {
      // Create a file with a dangerous name
      const safeTempPath = path.join(__dirname, 'fixtures', 'temp-dangerous.pdf');

      // Copy test PDF to temp file
      fs.copyFileSync(testPdfPath, safeTempPath);

      try {
        const response = await request(app.getHttpServer())
          .post('/api/v1/uploads')
          .set('Authorization', `Bearer ${authToken}`)
          .field('filename', '../../../etc/passwd.pdf')
          .attach('file', safeTempPath)
          .expect(201);

        // Filename should be sanitized (no path traversal)
        expect(response.body.storageKey).not.toContain('..');
        expect(response.body.fileName).not.toContain('..');
      } finally {
        // Cleanup
        if (fs.existsSync(safeTempPath)) {
          fs.unlinkSync(safeTempPath);
        }
      }
    });
  });
});
