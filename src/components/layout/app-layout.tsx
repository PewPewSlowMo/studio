'use client';
import { useState, useEffect, useMemo } from 'react';
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
  Sun,
  Cpu,
  Loader2,
  History,
  UserSearch,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
import type { User, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

const allMenuItems: Array<{ href: string; label: string; icon: React.ElementType; roles: UserRole[] }> = [
    { href: '/operator', label: 'Рабочее место', icon: Cpu, roles: ['operator'] },
    { href: '/my-calls', label: 'Мои звонки', icon: History, roles: ['operator'] },
    { href: '/crm-search', label: 'Поиск CRM', icon: UserSearch, roles: ['operator'] },
    { href: '/', label: 'Дашборд', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'manager'] },
    { href: '/reports', label: 'Отчет по операторам', icon: Users, roles: ['admin', 'supervisor', 'manager'] },
    { href: '/queue-reports', label: 'Отчет по очередям', icon: Phone, roles: ['admin', 'supervisor', 'manager'] },
    { href: '/missed-calls', label: 'Пропущенные звонки', icon: PhoneOff, roles: ['admin', 'supervisor', 'manager'] },
    { href: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['admin', 'supervisor', 'manager'] },
    { href: '/admin', label: 'Настройки', icon: Settings, roles: ['admin'] },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
        const user: User = JSON.parse(storedUser);
        setCurrentUser(user);

        const allowedRoutes = allMenuItems.filter(i => i.roles.includes(user.role));
        const hasAccess = allowedRoutes.some(route => route.href === '/' ? pathname === '/' : pathname.startsWith(route.href));
        
        if (!hasAccess && pathname !== '/login') {
             const defaultPath = user.role === 'operator' ? '/operator' : '/';
             router.replace(defaultPath);
             toast({
                variant: 'destructive',
                title: 'Доступ запрещен',
                description: 'У вас нет прав для просмотра этой страницы.',
            });
        }
    } else {
        if (pathname !== '/login') {
            router.replace('/login');
        }
    }
    setIsAuthCheckComplete(true);
  }, [pathname, router, toast]);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    router.push('/login');
  };

  const menuItems = useMemo(() => {
    if (!currentUser) return [];
    return allMenuItems.filter(item => item.roles.includes(currentUser.role));
  }, [currentUser]);

  const getPageTitle = () => {
     for (const item of allMenuItems) { // Use all items for title lookup
        if (pathname === item.href) return item.label;
    }
    if (pathname.startsWith('/reports')) return 'Отчет по операторам';
    if (pathname.startsWith('/missed-calls')) return 'Пропущенные звонки';
    if (pathname.startsWith('/admin')) return 'Настройки';
    if (pathname.startsWith('/queue-reports')) return 'Отчет по очередям';
    if (pathname.startsWith('/analytics')) return 'Аналитика';
    if (pathname.startsWith('/operator')) return 'Рабочее место';
    if (pathname.startsWith('/my-calls')) return 'Мои звонки';
    if (pathname.startsWith('/crm-search')) return 'Поиск CRM';
    return 'Дашборд';
  }
  
  const currentPage = getPageTitle();
  
  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (!isAuthCheckComplete) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

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
                  isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
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
                <SidebarMenuButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} tooltip="Сменить тему">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                  <span className="group-data-[collapsible=icon]:hidden">
                    {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout} tooltip="Выйти" className="text-destructive hover:!text-destructive focus:!text-destructive">
                    <LogOut />
                    <span>Выйти</span>
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
                    <AvatarImage src="https://placehold.co/100x100.png" alt={currentUser?.name} data-ai-hint="user avatar" />
                    <AvatarFallback>{currentUser?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left group-data-[collapsible=icon]:hidden">
                    <p className="font-semibold">{currentUser?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {currentUser?.role}
                    </p>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" side="top" align="start">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUser?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Профиль</DropdownMenuItem>
              <DropdownMenuItem>Биллинг</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                Выйти
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
