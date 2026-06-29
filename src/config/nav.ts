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
  { title: "Agents", href: "/agents", icon: Bot, permission: "agents:read" },
  {
    title: "Knowledge Base",
    href: "/knowledge-base",
    icon: BookOpen,
    permission: "knowledge_base:read",
  },
  {
    title: "Usage & Cost",
    href: "/usage",
    icon: Activity,
    permission: "usage:read",
    badge: "NEW",
  },
  { title: "Settings", href: "/settings/general", icon: Settings },
  {
    title: "Members",
    href: "/settings/members",
    icon: KeyRound,
    permission: "members:read",
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: DollarSign,
    permission: "billing:read",
  },
  {
    title: "API Keys",
    href: "/settings/api-keys",
    icon: KeyRound,
    permission: "api_keys:read",
  },
  {
    title: "Webhooks",
    href: "/settings/webhooks",
    icon: Webhook,
    permission: "webhooks:read",
  },
  {
    title: "Audit Log",
    href: "/settings/audit-log",
    icon: ScrollText,
    permission: "audit_log:read",
  },
  {
    title: "Compliance",
    href: "/settings/compliance",
    icon: ShieldCheck,
    permission: "compliance:read",
  },
];
