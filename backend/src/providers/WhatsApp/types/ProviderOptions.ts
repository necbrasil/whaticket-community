export interface SendMessageOptions {
  quotedMessageId?: string;
  quotedMessageFromMe?: boolean;
  linkPreview?: boolean;
  // jids of the people mentioned with "@number" in the body
  mentions?: string[];
}

export interface GroupParticipant {
  // full jid the library needs to mention the participant
  id: string;
  // user part of the jid, what is written after "@" in the text
  number: string;
  name: string;
}

export interface SendMediaOptions {
  caption?: string;
  sendAudioAsVoice?: boolean;
  sendMediaAsDocument?: boolean;
  quotedMessageId?: string;
}
