// src/uploader/providers/local-storage.provider.ts
import { Injectable } from '@nestjs/common';
import { FileUploader, UploadedFileResponse } from '../file-uploader.interface';
// Importer 'mkdir' depuis le module 'fs/promises' de Node.js
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStorageProvider implements FileUploader {
  constructor(private readonly configService: ConfigService) {}

  async uploadFile(file: Express.Multer.File): Promise<UploadedFileResponse> {
    const uploadsDir = join(__dirname, '..', '..', '..', 'uploads');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${file.originalname}`;
    const filePath = join(uploadsDir, filename);

    try {
      // --- CORRECTION APPLIQUÉE ICI ---
      // S'assurer que le répertoire 'uploads' existe.
      // L'option { recursive: true } fait que mkdir ne renvoie pas d'erreur si le dossier existe déjà.
      await mkdir(uploadsDir, { recursive: true });

      // Écrire le fichier
      await writeFile(filePath, file.buffer);
    } catch (error) {
      // Gérer les erreurs potentielles liées au système de fichiers
      console.error(
        "Erreur lors de l'écriture du fichier sur le disque :",
        error,
      );
      throw new Error('Impossible de sauvegarder le fichier.');
    }

    const port = this.configService.get<number>('PORT', 3000);
    const url = `http://localhost:${port}/uploads/${filename}`;

    return {
      url: url,
      providerId: filename,
    };
  }
}
