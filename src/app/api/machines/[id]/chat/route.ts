import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { askMachineAssistant, aiErrorMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const question = body?.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Dotaz je prázdný." }, { status: 400 });
  }

  const machine = await prisma.machine.findUnique({
    where: { id: params.id },
    include: {
      entries: { orderBy: { occurredAt: "desc" } },
      documents: true,
    },
  });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

  const docs = machine.documents.map((d) => ({
    fileId: d.fileId,
    filename: d.filename,
    kind: d.kind,
    isImage: d.isImage,
  }));

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            !!m &&
            typeof (m as { content?: unknown }).content === "string" &&
            ((m as { role?: unknown }).role === "user" ||
              (m as { role?: unknown }).role === "assistant")
        )
        .slice(-10)
    : [];

  try {
    const answer = await askMachineAssistant(machine, history, question, docs);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("AI chyba:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
