// src/uploader/uploader.module.ts
import { Module } from '@nestjs/common';
import { UploaderService } from './uploader.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileUploader } from './file-uploader.interface';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    UploaderService,
    // Les fournisseurs concrets doivent être enregistrés comme providers
    LocalStorageProvider,
    CloudinaryProvider,
    // Provider dynamique qui choisit la bonne stratégie
    {
      provide: FileUploader, // Le token d'injection est notre classe abstraite
      useFactory: (
        configService: ConfigService,
        localStorage: LocalStorageProvider,
        cloudinary: CloudinaryProvider,
      ) => {
        const provider = configService.get<string>('FILE_STORAGE_PROVIDER');
        switch (provider) {
          case 'cloudinary':
            return cloudinary;
          case 'local':
            return localStorage;
          default:
            return localStorage; // Stratégie par défaut
        }
      },
      inject: [ConfigService, LocalStorageProvider, CloudinaryProvider],
    },
  ],
  exports: [UploaderService], // Exporter le service pour l'utiliser ailleurs
})
export class UploaderModule {}
