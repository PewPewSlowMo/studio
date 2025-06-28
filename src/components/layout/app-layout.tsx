'use client';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  Phone,
  PhoneOff,
  LogOut,
  Moon,
  Cpu,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const menuItems = [
    { href: '/operator', label: 'Рабочее место', icon: Cpu },
    { href: '/', label: 'Дашборд', icon: LayoutDashboard },
    { href: '/reports', label: 'Отчет по операторам', icon: Users },
    { href: '/queue-reports', label: 'Отчет по очередям', icon: Phone },
    { href: '/missed-calls', label: 'Пропущенные звонки', icon: PhoneOff },
    { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    { href: '/admin', label: 'Настройки', icon: Settings },
  ];

  const getPageTitle = () => {
     for (const item of menuItems) {
        if (pathname === item.href) {
            return item.label;
        }
    }
    // Handle nested routes or default
    if (pathname.startsWith('/reports')) return 'Отчет по операторам';
    if (pathname.startsWith('/missed-calls')) return 'Пропущенные звонки';
    if (pathname.startsWith('/admin')) return 'Настройки';
    if (pathname.startsWith('/queue-reports')) return 'Отчет по очередям';
    if (pathname.startsWith('/analytics')) return 'Аналитика';
    if (pathname.startsWith('/operator')) return 'Рабочее место';
    return 'Дашборд';
  }
  
  const currentPage = getPageTitle();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <BarChart3 className="size-6 text-white" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <h1 className="text-xl font-bold text-primary">CallSync Central</h1>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  asChild
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 flex flex-col gap-1">
           <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Темная тема">
                  <Moon />
                  <span>Темная тема</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Выйти">
                    <Link href="/login" className="text-destructive hover:!text-destructive focus:!text-destructive">
                      <LogOut />
                      <span>Выйти</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
           </SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start p-2 mt-2 border-t pt-3"
              >
                <div className="flex w-full items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="https://placehold.co/100x100.png" alt="@admin" data-ai-hint="user avatar" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                  <div className="text-left group-data-[collapsible=icon]:hidden">
                    <p className="font-semibold">Администратор</p>
                    <p className="text-xs text-muted-foreground">
                      Администратор
                    </p>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" side="top" align="start">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Admin User</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    admin@callsync.app
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Профиль</DropdownMenuItem>
              <DropdownMenuItem>Биллинг</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/login">Выйти</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-sm">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">{currentPage}</h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
