import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToFiles, isImageType } from "@/lib/files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCEPTED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const MAX_BYTES = 32 * 1024 * 1024; // 32 MB (limit Files API pro PDF v dotazu)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const machine = await prisma.machine.findUnique({ where: { id: params.id } });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = (form.get("kind") as string) || "manual";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: "Povolené formáty: PDF, PNG, JPG, WEBP, GIF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Soubor je větší než 32 MB." },
      { status: 400 }
    );
  }

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

  const doc = await prisma.document.create({
    data: {
      machineId: params.id,
      fileId,
      filename: file.name,
      mediaType: file.type,
      kind,
      isImage: isImageType(file.type),
      sizeBytes: file.size,
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
