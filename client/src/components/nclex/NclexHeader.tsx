import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { subscribeStudentNotifications } from "@/lib/firestore/nclex";
import { STUDENT_NCLEX_DASHBOARD, STUDENT_NCLEX_HUB } from "@/lib/nclex/studentNclexRoutes";
import { Bell, BookText, ChevronDown, CircleHelp, FileText, Home, LogOut, Mail, MessageCircle, Presentation, User } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  /** e.g. link back to student home */
  homeHref?: string;
  homeLabel?: string;
};

export function NclexHeader({ title, subtitle, homeHref = "/", homeLabel = "Portfolio" }: Props) {
  const [, navigate] = useLocation();
  const { profile, signOut } = useFirebaseAuth();
  const [teachingUnread, setTeachingUnread] = useState(0);
  /** Shown on all student NCLEX surfaces; do not tie to homeHref (dashboard uses Portfolio link). */
  const showTeachingBell = profile?.role === "student";
  const showResources = Boolean(profile);

  useEffect(() => {
    if (!profile?.uid || !showTeachingBell) {
      setTeachingUnread(0);
      return;
    }
    return subscribeStudentNotifications(profile.uid, (rows) => {
      setTeachingUnread(rows.filter((r) => !r.read).length);
    });
  }, [profile?.uid, showTeachingBell]);

  const whatsappHref = "https://wa.me/254759550133";
  const emailHref = "mailto:hanningtonkuria5@gmail.com";

  const waKey = useMemo(() => (profile ? `nclex_wa_fab_pos_v1:${profile.uid}` : ""), [profile]);
  const [waVisible, setWaVisible] = useState(true);
  const [waPos, setWaPos] = useState<{ x: number; y: number }>(() => ({ x: 20, y: 20 }));
  const dragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>({ dragging: false, startX: 0, startY: 0, baseX: 20, baseY: 20 });

  useEffect(() => {
    if (!profile || !waKey) return;
    try {
      const raw = localStorage.getItem(waKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) setWaPos({ x, y });
    } catch {
      // ignore
    }
  }, [profile, waKey]);

  useEffect(() => {
    if (!profile) return;
    const minMs = 12_000;
    const maxMs = 28_000;
    let t: number | null = null;

    const schedule = () => {
      const wait = minMs + Math.floor(Math.random() * (maxMs - minMs));
      t = window.setTimeout(() => {
        // 25% chance to toggle visibility each tick
        if (Math.random() < 0.25) setWaVisible((v) => !v);
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      if (t != null) window.clearTimeout(t);
    };
  }, [profile?.uid]);

  const clampPos = (x: number, y: number) => {
    const pad = 12;
    const btn = 48; // 12x12 button
    const maxX = Math.max(pad, (window.innerWidth || 0) - btn - pad);
    const maxY = Math.max(pad, (window.innerHeight || 0) - btn - pad);
    return { x: Math.max(pad, Math.min(maxX, x)), y: Math.max(pad, Math.min(maxY, y)) };
  };

  const onWaPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    // Drag with primary pointer only.
    if (e.button !== 0) return;
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.baseX = waPos.x;
    dragRef.current.baseY = waPos.y;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onWaPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!dragRef.current.dragging) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = clampPos(dragRef.current.baseX + dx, dragRef.current.baseY + dy);
    setWaPos(next);
  };

  const onWaPointerUp = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    try {
      if (waKey) localStorage.setItem(waKey, JSON.stringify(waPos));
    } catch {
      // ignore
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <header className="nclex-header-bar sticky top-0 z-50">
        <div className="mx-auto flex h-12 max-w-[90rem] items-center justify-between gap-2 px-3 sm:h-14 sm:gap-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 pr-1">
          <p
            className="truncate text-xs font-bold tracking-tight sm:text-sm md:text-base"
            style={{ color: "var(--nclex-primary)" }}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-[11px] leading-tight nclex-text-muted sm:text-xs md:text-sm">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 overflow-x-auto sm:gap-2">
          {showResources ? (
            <>
              {showTeachingBell ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="relative h-8 gap-0.5 border-[var(--nclex-border)] bg-white/95 px-2 text-xs sm:h-9 sm:gap-1 sm:px-3 sm:text-sm"
                  asChild
                >
                  <Link href="/student/nclex/notifications">
                    <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Notes</span>
                    {teachingUnread > 0 ? (
                      <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]" variant="destructive">
                        {teachingUnread > 9 ? "9+" : teachingUnread}
                      </Badge>
                    ) : null}
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-0.5 border-[var(--nclex-border)] bg-white/95 px-2 text-xs sm:h-9 sm:gap-1 sm:px-3 sm:text-sm"
                asChild
              >
                <Link href="/student/nclex/study-guides">
                  <BookText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Study guides</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-0.5 border-[var(--nclex-border)] bg-white/95 px-2 text-xs sm:h-9 sm:gap-1 sm:px-3 sm:text-sm"
                asChild
              >
                <Link href="/student/nclex/class-notes">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Class notes</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-0.5 border-[var(--nclex-border)] bg-white/95 px-2 text-xs sm:h-9 sm:gap-1 sm:px-3 sm:text-sm"
                asChild
              >
                <Link href="/student/nclex/presentations">
                  <Presentation className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Presentations</span>
                </Link>
              </Button>
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 border-[var(--nclex-border)] bg-white" title="Help">
                <CircleHelp className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">Support</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="mt-0.5 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-emerald-700" />
                    </span>
                    <span className="flex-1 text-right font-semibold tabular-nums text-emerald-700">
                      +254 759 550 133
                    </span>
                  </span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={emailHref} className="flex w-full items-center justify-between gap-3">
                  <span className="mt-0.5 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-700" />
                  </span>
                  <span className="flex-1 text-right text-xs font-medium text-slate-700 break-all">
                    hanningtonkuria5@gmail.com
                  </span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-sm"
            onClick={() => navigate(homeHref)}
            title={homeLabel}
          >
            <Home className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">{homeLabel}</span>
          </Button>
          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 border-[var(--nclex-border)] bg-white">
                  <User className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.name ?? "Student"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                    <p className="text-xs capitalize text-muted-foreground">Role: {profile.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={STUDENT_NCLEX_DASHBOARD}>Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={STUDENT_NCLEX_HUB}>Change NCLEX track (RN / PN)</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/student/nclex/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tutor/nclex">Tutor dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => void signOut().then(() => navigate("/"))}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        </div>
      </header>

      {/* WhatsApp icon floats only at bottom-right (not in header). */}
      {profile && waVisible ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="fixed z-[60] inline-flex h-12 w-12 touch-none items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          title="WhatsApp support"
          style={{ right: waPos.x, bottom: waPos.y }}
          onPointerDown={onWaPointerDown}
          onPointerMove={onWaPointerMove}
          onPointerUp={onWaPointerUp}
          onPointerCancel={onWaPointerUp}
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      ) : null}
    </>
  );
}
