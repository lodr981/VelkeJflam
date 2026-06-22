import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { askMachineAssistant } from "@/lib/ai";

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
    include: { entries: { orderBy: { occurredAt: "desc" } } },
  });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

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
    const answer = await askMachineAssistant(machine, history, question);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("AI chyba:", err);
    return NextResponse.json(
      { error: "AI asistent je momentálně nedostupný." },
      { status: 502 }
    );
  }
}
