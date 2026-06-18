import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { FileService, NotFoundError, ValidationError } from '../../services/file.service';
import { FileModel, StorageProvider } from '../../models/file.model';
import { IStorage, StorageResult } from '../../types/storage.types';
import { MulterFile, UploadFileOptions } from '../../types/file.types';
import { ReadStream } from 'fs';
import { PassThrough } from 'stream';

// ---- Helpers ----

function makeMulterFile(overrides: Partial<MulterFile> = {}): MulterFile {
  return {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  };
}

function makeStorageResult(filename: string, overrides: Partial<StorageResult> = {}): StorageResult {
  return {
    filename,
    path: `/var/uploads/${filename}`,
    url: `http://localhost:3009/files/${filename}/download`,
    size: 1024,
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

function makeReadStream(): ReadStream {
  const pass = new PassThrough();
  setImmediate(() => {
    pass.write(Buffer.from('fake-content'));
    pass.end();
  });

  return pass as unknown as ReadStream;
}

// ---- Mock Storage ----

class MockStorage implements IStorage {
  save = jest.fn<Promise<StorageResult>, [Buffer, string, string]>();
  delete = jest.fn<Promise<void>, [string]>();
  getStream = jest.fn<ReadStream, [string]>();
  getUrl = jest.fn<string, [string]>((filename) => `http://localhost:3009/files/${filename}/download`);
}

// ---- Test suite ----

describe('FileService', () => {
  let mongod: MongoMemoryServer;
  let mockStorage: MockStorage;
  let fileService: FileService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(() => {
    mockStorage = new MockStorage();
    fileService = new FileService(mockStorage);
  });

  afterEach(async () => {
    await FileModel.deleteMany({});
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------ //
  // uploadFile
  // ------------------------------------------------------------------ //

  describe('uploadFile', () => {
    it('saves a file and persists the record to MongoDB', async () => {
      const file = makeMulterFile();
      const storageResult = makeStorageResult('abc123.jpg');
      mockStorage.save.mockResolvedValue(storageResult);

      const doc = await fileService.uploadFile('user-1', file);

      expect(mockStorage.save).toHaveBeenCalledTimes(1);
      expect(doc.originalName).toBe('test-image.jpg');
      expect(doc.mimeType).toBe('image/jpeg');
      expect(doc.uploaderId).toBe('user-1');
      expect(doc.isDeleted).toBe(false);
      expect(doc.storageProvider).toBe(StorageProvider.LOCAL);
    });

    it('applies upload options (projectId, isPublic, tags)', async () => {
      const file = makeMulterFile();
      const storageResult = makeStorageResult('xyz.jpg');
      mockStorage.save.mockResolvedValue(storageResult);

      const options: UploadFileOptions = {
        projectId: 'proj-1',
        isPublic: true,
        tags: ['docs', 'screenshot'],
      };

      const doc = await fileService.uploadFile('user-1', file, options);

      expect(doc.projectId).toBe('proj-1');
      expect(doc.isPublic).toBe(true);
      expect(doc.tags).toEqual(['docs', 'screenshot']);
    });

    it('propagates storage errors', async () => {
      const file = makeMulterFile();
      mockStorage.save.mockRejectedValue(new Error('Disk full'));

      await expect(fileService.uploadFile('user-1', file)).rejects.toThrow('Disk full');
    });

    it('uploads multiple files concurrently', async () => {
      const files = [
        makeMulterFile({ originalname: 'a.jpg' }),
        makeMulterFile({ originalname: 'b.jpg' }),
        makeMulterFile({ originalname: 'c.jpg' }),
      ];

      mockStorage.save
        .mockResolvedValueOnce(makeStorageResult('a.jpg'))
        .mockResolvedValueOnce(makeStorageResult('b.jpg'))
        .mockResolvedValueOnce(makeStorageResult('c.jpg'));

      const docs = await fileService.uploadMultipleFiles('user-1', files);

      expect(docs).toHaveLength(3);
      expect(mockStorage.save).toHaveBeenCalledTimes(3);
    });
  });

  // ------------------------------------------------------------------ //
  // getFile
  // ------------------------------------------------------------------ //

  describe('getFile', () => {
    it('returns an existing non-deleted file', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('findme.jpg'));
      const created = await fileService.uploadFile('user-1', makeMulterFile());

      const found = await fileService.getFile(String(created._id));

      expect(String(found._id)).toBe(String(created._id));
    });

    it('throws NotFoundError for a non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      await expect(fileService.getFile(fakeId)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a soft-deleted file', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('deleted.jpg'));
      mockStorage.delete.mockResolvedValue(undefined);
      const created = await fileService.uploadFile('user-1', makeMulterFile());

      await fileService.deleteFile(String(created._id), 'user-1');

      await expect(fileService.getFile(String(created._id))).rejects.toThrow(NotFoundError);
    });
  });

  // ------------------------------------------------------------------ //
  // getFiles
  // ------------------------------------------------------------------ //

  describe('getFiles', () => {
    beforeEach(async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('f1.jpg'));
      await fileService.uploadFile('user-1', makeMulterFile({ originalname: 'alpha.jpg' }), {
        projectId: 'proj-1',
        tags: ['alpha'],
      });

      mockStorage.save.mockResolvedValue(makeStorageResult('f2.png'));
      await fileService.uploadFile('user-2', makeMulterFile({ originalname: 'beta.png', mimetype: 'image/png' }), {
        projectId: 'proj-1',
        isPublic: true,
      });

      mockStorage.save.mockResolvedValue(makeStorageResult('f3.pdf'));
      await fileService.uploadFile('user-1', makeMulterFile({ originalname: 'report.pdf', mimetype: 'application/pdf' }), {
        projectId: 'proj-2',
      });
    });

    it('returns all non-deleted files with default pagination', async () => {
      const result = await fileService.getFiles({});

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
      expect(result.page).toBe(1);
    });

    it('filters by projectId', async () => {
      const result = await fileService.getFiles({ projectId: 'proj-1' });

      expect(result.total).toBe(2);
      result.data.forEach((d) => expect(d.projectId).toBe('proj-1'));
    });

    it('filters by uploaderId', async () => {
      const result = await fileService.getFiles({ uploaderId: 'user-2' });

      expect(result.total).toBe(1);
      expect(result.data[0]?.uploaderId).toBe('user-2');
    });

    it('filters by isPublic', async () => {
      const result = await fileService.getFiles({ isPublic: true });

      expect(result.total).toBe(1);
      expect(result.data[0]?.isPublic).toBe(true);
    });

    it('filters by tags', async () => {
      const result = await fileService.getFiles({ tags: ['alpha'] });

      expect(result.total).toBe(1);
      expect(result.data[0]?.tags).toContain('alpha');
    });

    it('searches by originalName', async () => {
      const result = await fileService.getFiles({ search: 'report' });

      expect(result.total).toBe(1);
      expect(result.data[0]?.originalName).toBe('report.pdf');
    });

    it('applies pagination correctly', async () => {
      const result = await fileService.getFiles({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.totalPages).toBe(2);
    });
  });

  // ------------------------------------------------------------------ //
  // deleteFile
  // ------------------------------------------------------------------ //

  describe('deleteFile', () => {
    it('soft-deletes a file and calls storage.delete', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('todel.jpg'));
      mockStorage.delete.mockResolvedValue(undefined);
      const created = await fileService.uploadFile('user-1', makeMulterFile());

      await fileService.deleteFile(String(created._id), 'user-1');

      const record = await FileModel.findById(created._id).exec();
      expect(record?.isDeleted).toBe(true);
      expect(mockStorage.delete).toHaveBeenCalledWith(created.path);
    });

    it('throws NotFoundError when file does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      await expect(fileService.deleteFile(fakeId, 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('soft-deletes even when storage.delete throws', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('storagerr.jpg'));
      mockStorage.delete.mockRejectedValue(new Error('S3 unreachable'));
      const created = await fileService.uploadFile('user-1', makeMulterFile());

      // Should not throw — storage error is logged but record is still soft-deleted
      await expect(fileService.deleteFile(String(created._id), 'user-1')).resolves.toBeUndefined();

      const record = await FileModel.findById(created._id).exec();
      expect(record?.isDeleted).toBe(true);
    });
  });

  // ------------------------------------------------------------------ //
  // getFileStream
  // ------------------------------------------------------------------ //

  describe('getFileStream', () => {
    it('returns a readable stream for an existing file', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('streamed.jpg'));
      const stream = makeReadStream();
      mockStorage.getStream.mockReturnValue(stream);

      const created = await fileService.uploadFile('user-1', makeMulterFile());
      const result = await fileService.getFileStream(String(created._id));

      expect(result).toBe(stream);
      expect(mockStorage.getStream).toHaveBeenCalledWith(created.path);
    });

    it('throws NotFoundError for a non-existent file', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      await expect(fileService.getFileStream(fakeId)).rejects.toThrow(NotFoundError);
    });
  });

  // ------------------------------------------------------------------ //
  // updateFileMetadata
  // ------------------------------------------------------------------ //

  describe('updateFileMetadata', () => {
    it('updates allowed metadata fields', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('meta.jpg'));
      const created = await fileService.uploadFile('user-1', makeMulterFile());

      const updated = await fileService.updateFileMetadata(String(created._id), {
        originalName: 'renamed.jpg',
        isPublic: true,
        tags: ['tag1', 'tag2'],
        projectId: 'proj-x',
      });

      expect(updated.originalName).toBe('renamed.jpg');
      expect(updated.isPublic).toBe(true);
      expect(updated.tags).toEqual(['tag1', 'tag2']);
      expect(updated.projectId).toBe('proj-x');
    });

    it('throws NotFoundError for an invalid ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      await expect(
        fileService.updateFileMetadata(fakeId, { originalName: 'nope.jpg' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ------------------------------------------------------------------ //
  // generateThumbnail
  // ------------------------------------------------------------------ //

  describe('generateThumbnail', () => {
    it('throws ValidationError for non-image files', async () => {
      mockStorage.save.mockResolvedValue(makeStorageResult('doc.pdf', { mimeType: 'application/pdf' }));
      const created = await fileService.uploadFile(
        'user-1',
        makeMulterFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' }),
      );

      await expect(fileService.generateThumbnail(String(created._id))).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws NotFoundError for a non-existent file', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();

      await expect(fileService.generateThumbnail(fakeId)).rejects.toThrow(NotFoundError);
    });

    it('returns cached thumbnailUrl if already generated', async () => {
      // Seed the record directly with a thumbnailUrl already set
      const doc = await FileModel.create({
        originalName: 'cached.jpg',
        filename: 'cached-abc.jpg',
        mimeType: 'image/jpeg',
        size: 512,
        path: '/var/uploads/cached-abc.jpg',
        url: 'http://localhost:3009/files/cached-abc.jpg/download',
        uploaderId: 'user-1',
        isPublic: false,
        tags: [],
        metadata: {},
        thumbnailUrl: 'http://localhost:3009/files/thumb_cached.jpg/download',
        storageProvider: StorageProvider.LOCAL,
        isDeleted: false,
      });

      const url = await fileService.generateThumbnail(String(doc._id));

      expect(url).toBe('http://localhost:3009/files/thumb_cached.jpg/download');
      expect(mockStorage.save).not.toHaveBeenCalled();
    });
  });
});
