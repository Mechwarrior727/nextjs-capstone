"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LoginProps {
    ready: any;
    authenticated: any;
    login: any;
    logout: any;
    user: any;
    linkedWallets: any;
}

const getInitials = (user: any) => {
    if (user?.google?.name) {
        const names = user.google.name.split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return user.google.name.slice(0, 2).toUpperCase();
    }

    if (user?.google?.email) {
        const email = user.google.email;
        const namePart = email.split('@')[0];
        return namePart.slice(0, 2).toUpperCase();
    }

    return "??";
};

const getDisplayName = (user: any) => {
    if (user?.google?.name) {
        return user.google.name;
    }

    if (user?.google?.email) {
        return user.google.email;
    }

    return "User";
};

export default function Login({ ready, authenticated, login, logout, user, linkedWallets }: LoginProps) {
    const initials = getInitials(user);
    const displayName = getDisplayName(user);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && theme === "dark";

    return (
        <>
            <header className="fixed top-6 right-6 z-50">
                {ready && authenticated ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">
                                <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-violet-400 transition-all">
                                    <AvatarImage src={user?.google?.picture || ""} alt={displayName} />
                                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 mr-2" align="end">
                            <DropdownMenuLabel>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={user?.google?.picture || ""} alt={displayName} />
                                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold">{displayName}</span>
                                        {user?.google?.email && (
                                            <span className="text-xs text-muted-foreground">
                                                {user.google.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.preventDefault();
                                    setTheme(isDark ? "light" : "dark");
                                }}
                                className="cursor-pointer"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center">
                                        <Moon className="mr-2 h-4 w-4" />
                                        <span>Dark Mode</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTheme(isDark ? "light" : "dark");
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? "bg-violet-600" : "bg-gray-300"
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? "translate-x-6" : "translate-x-1"
                                                }`}
                                        />
                                    </button>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={logout}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <button
                        onClick={() => login({ method: "google" })}
                        className="rounded-full bg-violet-600 hover:bg-violet-700 py-2 px-4 text-white transition-colors"
                    >
                        Login
                    </button>
                )}
            </header>
        </>
    );
}