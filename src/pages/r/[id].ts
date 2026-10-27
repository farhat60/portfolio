import type { APIRoute } from "astro";
import { getResumeFile, isResumeId, pdfResponse } from "../../lib/resumes";

export const prerender = false;

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? "";

  if (!isResumeId(id)) {
    return notFound();
  }

  try {
    const file = await getResumeFile(id);
    return file ? pdfResponse(file) : notFound();
  } catch (error) {
    console.error("Resume unavailable", error);
    return new Response("Unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
};
