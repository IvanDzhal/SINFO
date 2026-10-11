import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private bucket = process.env.S3_BUCKET ?? 'sinfo';
  private client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });
  private ready: Promise<unknown> | null = null;

  private ensureBucket() {
    if (!this.ready) {
      this.ready = this.client
        .send(new HeadBucketCommand({ Bucket: this.bucket }))
        .catch(() => this.client.send(new CreateBucketCommand({ Bucket: this.bucket })))
        .catch((e) => {
          this.ready = null;
          throw e;
        });
    }
    return this.ready;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Readable> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return out.Body as unknown as Readable;
    } catch {
      throw new NotFoundException('Файл не знайдено у сховищі');
    }
  }
}