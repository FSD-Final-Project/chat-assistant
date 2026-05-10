import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false, versionKey: false })
export class RocketIntegration {
  @Prop()
  encryptedUserToken?: string;

  @Prop()
  encryptedUserId?: string;

  @Prop({ enum: ["pending", "syncing", "completed", "failed"], default: "pending" })
  syncStatus?: "pending" | "syncing" | "completed" | "failed";

  @Prop()
  syncStartedAt?: Date;

  @Prop()
  syncCompletedAt?: Date;

  @Prop()
  syncError?: string;

  @Prop()
  updatedAt?: Date;
}

@Schema({ _id: false, versionKey: false })
export class LocalAuth {
  @Prop()
  passwordHash?: string;

  @Prop()
  refreshTokenHash?: string;

  @Prop()
  refreshTokenExpiresAt?: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  googleId!: string;

  @Prop({ required: true, unique: true, index: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  givenName?: string;

  @Prop()
  familyName?: string;

  @Prop()
  picture?: string;

  @Prop({ required: true, enum: ["google", "local"], default: "google" })
  authProvider!: "google" | "local";

  @Prop({ type: LocalAuth, default: null })
  localAuth?: LocalAuth | null;

  @Prop({ type: RocketIntegration, default: null })
  rocketIntegration?: RocketIntegration | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
