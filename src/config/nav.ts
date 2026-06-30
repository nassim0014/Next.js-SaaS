import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  DollarSign,
  Settings,
  KeyRound,
  Webhook,
  ScrollText,
  ShieldCheck,
  Activity,
  MessageSquare,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  badge?: string;
};

export const dashboardNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", href: "/dashboard/chat", icon: MessageSquare },
  { title: "Agents", href: "/dashboard/agents", icon: Bot, permission: "agents:read" },
  {
    title: "Knowledge Base",
    href: "/dashboard/knowledge-base",
    icon: BookOpen,
    permission: "knowledge_base:read",
  },
  {
    title: "Usage & Cost",
    href: "/dashboard/usage",
    icon: Activity,
    permission: "usage:read",
    badge: "NEW",
  },
  { title: "Settings", href: "/dashboard/settings/general", icon: Settings },
  {
    title: "Members",
    href: "/dashboard/settings/members",
    icon: KeyRound,
    permission: "members:read",
  },
  {
    title: "Billing",
    href: "/dashboard/settings/billing",
    icon: DollarSign,
    permission: "billing:read",
  },
  {
    title: "API Keys",
    href: "/dashboard/settings/api-keys",
    icon: KeyRound,
    permission: "api_keys:read",
  },
  {
    title: "Webhooks",
    href: "/dashboard/settings/webhooks",
    icon: Webhook,
    permission: "webhooks:read",
  },
  {
    title: "Audit Log",
    href: "/dashboard/settings/audit-log",
    icon: ScrollText,
    permission: "audit_log:read",
  },
  {
    title: "Compliance",
    href: "/dashboard/settings/compliance",
    icon: ShieldCheck,
    permission: "compliance:read",
  },
];
