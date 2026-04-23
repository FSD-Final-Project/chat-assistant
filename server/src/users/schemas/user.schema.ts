import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false, versionKey: false })
export class RocketIntegration {
  @Prop()
  encryptedUserToken?: string;

  @Prop()
  encryptedUserId?: string;

  @Prop()
  updatedAt?: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  googleId!: string;

  @Prop({ required: true, index: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  givenName?: string;

  @Prop()
  familyName?: string;

  @Prop()
  picture?: string;

  @Prop({ type: RocketIntegration, default: null })
  rocketIntegration?: RocketIntegration | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
