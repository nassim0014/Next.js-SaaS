import { z } from "zod";

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().uuid(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
