// src/uploader/providers/cloudinary.provider.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { FileUploader, UploadedFileResponse } from '../file-uploader.interface';

@Injectable()
export class CloudinaryProvider implements FileUploader {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadedFileResponse> {
    return new Promise<UploadedFileResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto' }, // Permet de téléverser des images, vidéos, etc.
        (error, result: UploadApiResponse) => {
          if (error) {
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            providerId: result.public_id,
          });
        },
      );
      // Écrit le buffer du fichier dans le stream de Cloudinary
      uploadStream.end(file.buffer);
    });
  }
}
