export interface RocketChatUserRef {
  _id: string;
  username?: string;
}

export interface RocketChatMessage {
  _id: string;
  msg?: string;
  u?: RocketChatUserRef;
}

export interface RocketChatDirectRoom {
  _id: string;
}

export interface RocketChatLoginResponse {
  status: string;
  data?: {
    authToken: string;
    userId: string;
  };
}

export interface RocketChatImListResponse {
  ims?: RocketChatDirectRoom[];
}

export interface RocketChatMessagesResponse {
  messages?: RocketChatMessage[];
}

