export interface RocketChatUserRef {
  _id: string;
  username?: string;
}

export interface RocketChatMessage {
  _id: string;
  rid?: string;
  msg?: string;
  u?: RocketChatUserRef;
  ts?: string | { $date?: number };
  [key: string]: unknown;
}

export interface RocketChatDirectRoom {
  _id: string;
}

export interface RocketChatImListResponse {
  ims?: RocketChatDirectRoom[];
}

export interface RocketChatMessagesResponse {
  messages?: RocketChatMessage[];
}

export interface RocketChatPostMessageResponse {
  message?: RocketChatMessage;
}

export interface RocketChatChannel {
  _id: string;
}

export interface RocketChatChannelListResponse {
  channels?: RocketChatChannel[];
}

export interface RocketChatGroup {
  _id: string;
}

export interface RocketChatGroupListResponse {
  groups?: RocketChatGroup[];
}
