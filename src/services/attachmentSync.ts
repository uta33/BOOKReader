import {
  createAttachmentId,
  downloadAttachment,
  uploadAttachment,
} from './attachmentClient';
import { useLibraryStore } from '../store/libraryStore';

export interface AttachmentSyncResult {
  metadataChanged: boolean;
  uploaded: number;
  downloaded: number;
}

export async function syncAttachmentsNow(): Promise<AttachmentSyncResult> {
  const result: AttachmentSyncResult = { metadataChanged: false, uploaded: 0, downloaded: 0 };
  const snapshot = useLibraryStore.getState().allBooks;
  for (const book of snapshot) {
    if (book.deletedAt) continue;
    for (const dogEar of book.dogEars) {
      if (dogEar.deletedAt) continue;
      if (dogEar.photoUri && !dogEar.photoAttachmentId) {
        useLibraryStore.getState().updateDogEar(book.id, dogEar.id, {
          photoAttachmentId: createAttachmentId(),
          photoAttachmentSyncedAt: undefined,
        });
        result.metadataChanged = true;
        continue;
      }
      if (dogEar.photoUri && dogEar.photoAttachmentId && !dogEar.photoAttachmentSyncedAt) {
        await uploadAttachment(dogEar.photoAttachmentId, dogEar.id, dogEar.photoUri);
        useLibraryStore.getState().setDogEarLocalFields(book.id, dogEar.id, {
          photoAttachmentSyncedAt: Date.now(),
        });
        result.uploaded += 1;
        continue;
      }
      if (!dogEar.photoUri && dogEar.photoAttachmentId) {
        const photoUri = await downloadAttachment(dogEar.photoAttachmentId, dogEar.id);
        useLibraryStore.getState().setDogEarLocalFields(book.id, dogEar.id, {
          photoUri,
          photoAttachmentSyncedAt: Date.now(),
        });
        result.downloaded += 1;
      }
    }
  }
  await useLibraryStore.getState().saveLibrary();
  return result;
}
