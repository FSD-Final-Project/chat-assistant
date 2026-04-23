export interface SessionUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  hasRocketIntegration?: boolean;
}
