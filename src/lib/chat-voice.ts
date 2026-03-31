/** Values sent to `/api/ai/chat` and Open Paper chat (prepended hint). */
export const CHAT_VOICE_OPTIONS = [
  { id: "frat_bro", label: "Frat bro" },
  { id: "sorority_chick", label: "Sorority chick" },
  { id: "english", label: "English" },
  { id: "spanish", label: "Spanish" },
  { id: "french", label: "French" },
  { id: "german", label: "German" },
  { id: "italian", label: "Italian" },
  { id: "portuguese", label: "Portuguese" },
  { id: "chinese", label: "Chinese (Mandarin)" },
  { id: "japanese", label: "Japanese" },
  { id: "korean", label: "Korean" },
  { id: "arabic", label: "Arabic" },
  { id: "hindi", label: "Hindi" },
] as const;

export type ChatVoiceId = (typeof CHAT_VOICE_OPTIONS)[number]["id"];

export const DEFAULT_CHAT_VOICE: ChatVoiceId = "frat_bro";

export function getChatVoiceInstruction(voiceId: string): string {
  switch (voiceId) {
    case "frat_bro":
      return "Voice: friendly college \"frat bro\" energy — casual, enthusiastic, still factually correct. No slurs or put-downs; stay respectful.";
    case "sorority_chick":
      return "Voice: friendly \"sorority\" energy — upbeat, casual, still factually correct. No mean stereotypes; stay respectful.";
    case "english":
      return "Respond in clear English (neutral tone) unless the user asks otherwise.";
    case "spanish":
      return "Respond in Spanish (neutral) with clear explanations.";
    case "french":
      return "Respond in French with clear explanations.";
    case "german":
      return "Respond in German with clear explanations.";
    case "italian":
      return "Respond in Italian with clear explanations.";
    case "portuguese":
      return "Respond in Portuguese (Brazilian or European neutral) with clear explanations.";
    case "chinese":
      return "Respond in Mandarin Chinese with clear explanations (simplified characters unless the user asks otherwise).";
    case "japanese":
      return "Respond in Japanese with clear explanations.";
    case "korean":
      return "Respond in Korean with clear explanations.";
    case "arabic":
      return "Respond in Modern Standard Arabic with clear explanations.";
    case "hindi":
      return "Respond in Hindi with clear explanations.";
    default:
      return getChatVoiceInstruction(DEFAULT_CHAT_VOICE);
  }
}

/** Short prefix for Open Paper upstream when we cannot change their system prompt. */
export function openPaperVoicePrefix(voiceId: string): string {
  const line = getChatVoiceInstruction(voiceId);
  return `[Assistant style: ${line}]\n\n`;
}
