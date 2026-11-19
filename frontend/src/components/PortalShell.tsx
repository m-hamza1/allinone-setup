"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GalleryVerticalEndIcon, LogOutIcon } from "lucide-react";
import { User } from "@/lib/api";
import { isActivePath, type NavGroup, type NavItem } from "@/lib/nav";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  if (item.children?.length) {
    const open = item.children.some((child) => child.href && isActivePath(pathname, child.href));
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.label} isActive={open}>
          <item.icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.href ?? child.label}>
              <SidebarMenuSubButton
                asChild
                isActive={Boolean(child.href && isActivePath(pathname, child.href))}
              >
                <Link href={child.href ?? "#"}>
                  <span>{child.label}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    );
  }

  const active = item.href ? isActivePath(pathname, item.href) : false;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href ?? "#"}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PortalShell({
  brand,
  eyebrow,
  homeHref,
  nav,
  user,
  onLogout,
  children,
  flush = false,
  showTopbar = true,
  contentClassName,
}: {
  brand: string;
  eyebrow: string;
  homeHref: string;
  nav: NavGroup[];
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  /** Edge-to-edge content (Chatwoot inbox) */
  flush?: boolean;
  showTopbar?: boolean;
  contentClassName?: string;
}) {
  const pathname = usePathname();
  const isWorkspaceSurface =
    pathname.includes("/inbox") ||
    pathname.includes("/mentions") ||
    pathname.includes("/contacts") ||
    pathname.includes("/participating") ||
    pathname.includes("/unattended");
  const useFlush = flush || isWorkspaceSurface;
  const useTopbar = showTopbar && !useFlush;

  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "AL";

  return (
    <SidebarProvider defaultOpen className="h-svh min-h-0 overflow-hidden">
      <Sidebar collapsible="icon" variant="sidebar" className="border-r border-border">
        <SidebarHeader className="border-b border-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip={brand} asChild>
                <Link href={homeHref}>
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                    <GalleryVerticalEndIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{brand}</span>
                    <span className="text-muted-foreground truncate text-xs">{eyebrow}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {nav.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavRow key={item.href ?? item.label} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip={user?.email ?? "Account"}>
                <div className="bg-sidebar-accent flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
                  {initials}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.name ?? "—"}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user?.role?.replaceAll("_", " ")}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sign out" onClick={onLogout}>
                <LogOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden bg-[var(--surface-2)]">
        {useTopbar ? (
          <header className="bg-surface flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
            <SidebarTrigger className="-ml-0.5" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4"
            />
            <span className="text-muted-foreground text-xs">{eyebrow}</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="truncate text-sm font-medium">
              {user?.account?.name ?? brand}
            </span>
          </header>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            useFlush ? "overflow-hidden" : "overflow-auto",
            contentClassName,
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
