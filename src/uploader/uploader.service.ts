// src/uploader/uploader.service.ts
import { Injectable } from '@nestjs/common';
import { FileUploader } from './file-uploader.interface';

@Injectable()
export class UploaderService {
  // Le fournisseur concret (LocalStorage, Cloudinary, etc.) sera injecté ici
  constructor(private readonly fileUploader: FileUploader) {}

  async upload(file: Express.Multer.File) {
    if (!file) {
      throw new Error('Aucun fichier à téléverser.');
    }
    return this.fileUploader.uploadFile(file);
  }
}