// src/uploader/file-uploader.interface.ts
export interface UploadedFileResponse {
  url: string; // L'URL publique du fichier
  providerId: string; // L'ID du fichier chez le fournisseur (ex: public_id de Cloudinary)
}

export abstract class FileUploader {
  abstract uploadFile(file: Express.Multer.File): Promise<UploadedFileResponse>;
}
