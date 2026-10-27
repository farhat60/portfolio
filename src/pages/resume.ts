import type { APIRoute } from "astro";
import { serveMainResume } from "../lib/resumes";

export const prerender = false;

export const GET: APIRoute = () => serveMainResume();
