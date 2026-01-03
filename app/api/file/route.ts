import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

function isPathTraversal(filePath: string): boolean {
  return filePath.includes("..");
}

function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

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

  try {
    const content = await readFile(filePath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

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

  try {
    const content = await request.text();
    await writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 }
    );
  }
}
