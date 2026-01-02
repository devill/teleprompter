import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

interface MetaData {
  comments: unknown[];
}

const EMPTY_META: MetaData = { comments: [] };

function isPathTraversal(filePath: string): boolean {
  return filePath.includes("..");
}

function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

function getMetaFilePath(originalPath: string): string {
  return `${originalPath}.meta.json`;
}

function validatePath(filePath: string | null): NextResponse | null {
  if (!filePath) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 }
    );
  }

  if (isPathTraversal(filePath)) {
    return NextResponse.json(
      { error: "Path traversal not allowed" },
      { status: 400 }
    );
  }

  if (!isAbsolutePath(filePath)) {
    return NextResponse.json(
      { error: "Path must be absolute" },
      { status: 400 }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  const validationError = validatePath(filePath);
  if (validationError) return validationError;

  const metaPath = getMetaFilePath(filePath!);

  try {
    const content = await readFile(metaPath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json(EMPTY_META);
    }
    return NextResponse.json(
      { error: "Failed to read meta file" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  const validationError = validatePath(filePath);
  if (validationError) return validationError;

  const metaPath = getMetaFilePath(filePath!);

  try {
    const body = await request.json();
    await writeFile(metaPath, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to save meta file" },
      { status: 500 }
    );
  }
}
