import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

// A tiny key-value file store. Production uses a private Vercel Blob store;
// local dev writes to a gitignored `.resumes/` folder so nothing needs Vercel.

export interface StoredObject {
  pathname: string;
  size: number;
  uploadedAt: Date;
}

export interface StoredFile {
  body: ReadableStream<Uint8Array> | Uint8Array;
  size: number;
}

interface Storage {
  list(): Promise<StoredObject[]>;
  read(pathname: string): Promise<StoredFile | null>;
  write(pathname: string, data: Buffer, contentType: string): Promise<void>;
  remove(pathnames: string[]): Promise<void>;
}

const blobStorage: Storage = {
  async list() {
    const objects: StoredObject[] = [];
    let cursor: string | undefined;

    do {
      const page = await list({ cursor, limit: 1000 });
      objects.push(
        ...page.blobs.map((blob) => ({
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: new Date(blob.uploadedAt),
        }))
      );
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return objects;
  },

  async read(pathname) {
    const result = await get(pathname, { access: "private" });

    if (!result || result.statusCode !== 200) {
      return null;
    }

    return { body: result.stream, size: result.blob.size };
  },

  async write(pathname, data, contentType) {
    await put(pathname, data, { access: "private", contentType });
  },

  async remove(pathnames) {
    if (pathnames.length > 0) {
      await del(pathnames);
    }
  },
};

const localRoot = path.resolve(".resumes");

const localStorage: Storage = {
  async list() {
    const entries = await fs
      .readdir(localRoot, { recursive: true, withFileTypes: true })
      .catch(() => []);
    const files = entries.filter((entry) => entry.isFile());

    return Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(entry.parentPath, entry.name);
        const stats = await fs.stat(fullPath);

        return {
          pathname: path.relative(localRoot, fullPath).split(path.sep).join("/"),
          size: stats.size,
          uploadedAt: stats.mtime,
        };
      })
    );
  },

  async read(pathname) {
    try {
      const data = await fs.readFile(path.join(localRoot, pathname));
      return { body: new Uint8Array(data), size: data.length };
    } catch {
      return null;
    }
  },

  async write(pathname, data) {
    const fullPath = path.join(localRoot, pathname);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  },

  async remove(pathnames) {
    await Promise.all(
      pathnames.map((pathname) => fs.rm(path.join(localRoot, pathname), { force: true }))
    );
  },
};

// On Vercel the filesystem is read-only, so always use Blob there.
export const storage: Storage =
  process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN ? blobStorage : localStorage;
