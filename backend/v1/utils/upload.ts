import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';
import logger from '../../utils/logger.js';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

type CloudinaryResourceTypes = "image" | "video" | "raw" | "auto" | undefined

export const uploadBuffer = async (file: Express.Multer.File, folder = 'vunoh', resourceType: CloudinaryResourceTypes = "auto"): Promise<string> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: resourceType
            },
            (error, result) => {
                if (error) {
                    logger.error({ error }, 'Cloudinary upload error');
                    reject(error);
                    return;
                }

                if (!result?.secure_url) {
                    reject(new Error('Cloudinary upload did not return a secure URL'));
                    return;
                }

                resolve(result.secure_url);
            }
        );

        stream.end(file.buffer);
    });
};

export const uploadBuffers = async (files: Express.Multer.File[] = []): Promise<string[]> => {
    return Promise.all(files.map((file) => uploadBuffer(file)));
};

export const deleteUpload = async (imageUrl: string, resourceType: CloudinaryResourceTypes) => {
  try {
    const url = new URL(imageUrl);

    const pathParts = url.pathname.split("/");

    // Find the "upload" segment
    const uploadIndex = pathParts.indexOf("upload");

    if (uploadIndex === -1) {
      throw new Error("Invalid Cloudinary URL");
    }

    // Everything after "upload"
    let publicIdParts = pathParts.slice(uploadIndex + 1);

    // Remove version, e.g. v1783410819
    if (/^v\d+$/.test(publicIdParts[0])) {
      publicIdParts.shift();
    }

    // Remove file extension from the last part
    const lastIndex = publicIdParts.length - 1;

    publicIdParts[lastIndex] = publicIdParts[lastIndex].replace(
      /\.[^/.]+$/,
      ""
    );

    const publicId = publicIdParts.join("/");

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "upload",
    });

    return result;
  } catch (error) {
    throw error;
  }
};