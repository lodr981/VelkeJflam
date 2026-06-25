import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToFiles, isImageType, getUploadedFile } from "@/lib/files";
import { distillDocument, distillTextDocument } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const ACCEPTED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
// Textový source (PLC SCL/STL/XML…) – zpracuje se bez Files API.
const TEXT_EXT = /\.(scl|awl|stl|st|txt|xml|l5x|exp|csv|json)$/i;
const MAX_BYTES = 32 * 1024 * 1024; // 32 MB

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const machine = await prisma.machine.findUnique({ where: { id: params.id } });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

  const form = await req.formData();
  const file = getUploadedFile(form.get("file"));
  const kind = (form.get("kind") as string) || "manual";

  if (!file) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const isText = TEXT_EXT.test(file.name) && !ACCEPTED.includes(file.type);
  if (!isText && !ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: "Povolené formáty: PDF, obrázek, nebo PLC source (.scl/.stl/.awl/.xml/.txt)." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Soubor je větší než 32 MB." }, { status: 400 });
  }

  // Textový source (PLC SCL/STL/XML…) – bez Files API: rovnou destilace nad textem.
  if (isText) {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
    const digest = await distillTextDocument(text, file.name, kind);
    const doc = await prisma.document.create({
      data: {
        machineId: params.id,
        fileId: null,
        filename: file.name,
        mediaType: file.type || "text/plain",
        kind,
        isImage: false,
        sizeBytes: file.size,
        rawText: text.slice(0, 1_000_000),
        digest,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  }

  // PDF / obrázek → Files API + destilace.
  const buffer = Buffer.from(await file.arrayBuffer());
  let fileId: string;
  try {
    fileId = await uploadToFiles(buffer, file.name, file.type);
  } catch (err) {
    console.error("Files API chyba:", err);
    return NextResponse.json(
      { error: "Nahrání k AI se nezdařilo (zkontroluj ANTHROPIC_API_KEY)." },
      { status: 502 }
    );
  }

  const isImage = isImageType(file.type);
  const digest = await distillDocument(fileId, isImage, file.name, kind);

  const doc = await prisma.document.create({
    data: {
      machineId: params.id,
      fileId,
      filename: file.name,
      mediaType: file.type,
      kind,
      isImage,
      sizeBytes: file.size,
      digest,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ error: "Chybí docId." }, { status: 400 });
  }
  await prisma.document.deleteMany({
    where: { id: docId, machineId: params.id },
  });
  return NextResponse.json({ ok: true });
}
