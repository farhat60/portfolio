import { randomBytes } from "node:crypto";
import { storage, type StoredFile, type StoredObject } from "./storage";

// Layout in storage:
//   resumes/<id>/<version>-<label>.pdf   one file per resume (the newest version wins)
//   main/<id>.txt                        marks the resume served at /resume
// The label is base64url-encoded so any text is safe in a pathname.

export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_LABEL_LENGTH = 60;

const ID = "[A-Za-z0-9_-]{11}";
const ID_RE = new RegExp(`^${ID}$`);
const VERSION_RE = new RegExp(`^resumes/(${ID})/([0-9a-z]+)-([A-Za-z0-9_-]*)\\.pdf$`);
const MAIN_RE = new RegExp(`^main/(${ID})\\.txt$`);

export interface Resume {
  id: string;
  label: string;
  updatedAt: Date;
  size: number;
  isMain: boolean;
}

interface Version extends StoredObject {
  id: string;
  version: number;
  label: string;
}

export class ResumeError extends Error {}

export const isResumeId = (value: string) => ID_RE.test(value);

const encodeLabel = (label: string) => Buffer.from(label, "utf8").toString("base64url");
const decodeLabel = (encoded: string) => Buffer.from(encoded, "base64url").toString("utf8");
const versionPath = (id: string, version: number, label: string) =>
  `resumes/${id}/${version.toString(36)}-${encodeLabel(label)}.pdf`;
const mainPath = (id: string) => `main/${id}.txt`;

async function readState() {
  const versions = new Map<string, Version[]>();
  const mainIds: string[] = [];

  for (const object of await storage.list()) {
    const version = VERSION_RE.exec(object.pathname);
    const main = MAIN_RE.exec(object.pathname);

    if (version) {
      const [, id, stamp, label] = version;
      const list = versions.get(id) ?? [];
      list.push({ ...object, id, version: parseInt(stamp, 36), label: decodeLabel(label) });
      versions.set(id, list);
    } else if (main) {
      mainIds.push(main[1]);
    }
  }

  for (const list of versions.values()) {
    list.sort((a, b) => b.version - a.version);
  }

  return { versions, mainIds };
}

export async function listResumes(): Promise<Resume[]> {
  const { versions, mainIds } = await readState();

  return Array.from(versions.values(), ([latest]) => ({
    id: latest.id,
    label: latest.label,
    updatedAt: latest.uploadedAt,
    size: latest.size,
    isMain: mainIds.includes(latest.id),
  })).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getResumeFile(id: string): Promise<StoredFile | null> {
  const { versions } = await readState();
  const latest = versions.get(id)?.[0];
  return latest ? storage.read(latest.pathname) : null;
}

export async function getMainResumeFile(): Promise<StoredFile | null> {
  const { versions, mainIds } = await readState();
  const id = mainIds.find((candidate) => versions.has(candidate));
  const latest = id ? versions.get(id)?.[0] : undefined;
  return latest ? storage.read(latest.pathname) : null;
}

export function checkPdf(data: Buffer) {
  if (data.length === 0 || data.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ResumeError("nopdf");
  }

  if (data.length > MAX_PDF_BYTES) {
    throw new ResumeError("big");
  }
}

export async function addResume(label: string, data: Buffer): Promise<string> {
  const cleanLabel = label.trim().slice(0, MAX_LABEL_LENGTH);

  if (!cleanLabel) {
    throw new ResumeError("nolabel");
  }

  checkPdf(data);
  const id = randomBytes(8).toString("base64url");
  await storage.write(versionPath(id, Date.now(), cleanLabel), data, "application/pdf");
  return id;
}

export async function replaceResume(id: string, data: Buffer) {
  checkPdf(data);
  const { versions } = await readState();
  const existing = versions.get(id);

  if (!existing) {
    throw new ResumeError("missing");
  }

  // Write the new version before deleting the old ones, so the link never 404s.
  const [latest] = existing;
  const version = Math.max(Date.now(), latest.version + 1);
  await storage.write(versionPath(id, version, latest.label), data, "application/pdf");
  await storage.remove(existing.map((entry) => entry.pathname));
}

export async function deleteResume(id: string) {
  const { versions, mainIds } = await readState();
  const existing = versions.get(id);

  if (!existing) {
    throw new ResumeError("missing");
  }

  const markers = mainIds.includes(id) ? [mainPath(id)] : [];
  await storage.remove([...existing.map((entry) => entry.pathname), ...markers]);
}

export async function setMainResume(id: string) {
  const { versions, mainIds } = await readState();

  if (!versions.has(id)) {
    throw new ResumeError("missing");
  }

  if (!mainIds.includes(id)) {
    await storage.write(mainPath(id), Buffer.from(id), "text/plain");
  }

  await storage.remove(mainIds.filter((other) => other !== id).map(mainPath));
}

export function pdfResponse(file: StoredFile) {
  return new Response(file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": 'inline; filename="Abdullah Farhat Resume.pdf"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

// /resume and /resume.pdf: the Main resume, or the committed copy if none is set
// or storage is unreachable, so the public link never breaks.
export async function serveMainResume() {
  try {
    const file = await getMainResumeFile();

    if (file) {
      return pdfResponse(file);
    }
  } catch (error) {
    console.error("Main resume unavailable", error);
  }

  return new Response(null, { status: 302, headers: { Location: "/resume-default.pdf" } });
}
