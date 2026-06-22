export type MachineWithEntries = {
  id: string;
  name: string;
  type: string | null;
  manufacturer: string | null;
  year: number | null;
  location: string | null;
  photoUrl: string | null;
  manualText: string | null;
  notes: string | null;
  createdAt: string;
  entries: LogEntryDTO[];
};

export type LogEntryDTO = {
  id: string;
  occurredAt: string;
  problem: string;
  solution: string | null;
  partsCost: number | null;
  downtimeMinutes: number | null;
  technician: string | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
