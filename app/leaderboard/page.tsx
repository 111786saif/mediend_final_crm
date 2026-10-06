"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
    Trophy,
    Award,
    Medal,
    Search,
    Calendar,
    Filter,
    RefreshCw,
    Sun,
    Moon,
    Clock,
    Sparkles,
    Rocket,
    ChevronDown
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import logo from "@/public/logo-mediend.png";

export interface ApiLeaderboardEntry {
    id: string;
    userId: string;
    name: string;
    profilePicture: string | null;
    category: string;
    targetValue: number;
    actual: number;
    percentage: number;
    annualActual: number;
    rank: number;
}

export interface ApiData {
    month: string;
    category: string;
    categories: string[];
    monthlyTopThree: {
        first: ApiLeaderboardEntry | null;
        second: ApiLeaderboardEntry | null;
        third: ApiLeaderboardEntry | null;
    };
    rankings: ApiLeaderboardEntry[];
}

export interface CelebrationEvent {
    id: string;
    bdName: string;
    category: string;
    newActual: number;
    timestamp: Date;
}

export interface PodiumCardProps {
    title: string;
    icon: React.ReactNode;
    categoryLabel: string;
    podiumData: (ApiLeaderboardEntry | null)[];
    isDarkMode: boolean;
    valueFormatter: (bd: ApiLeaderboardEntry | null) => { primary: string; secondary: string };
    badgeColorClass: string;
}

export const SteppedPodiumCard: React.FC<PodiumCardProps> = ({
    title,
    icon,
    categoryLabel,
    podiumData,
    isDarkMode,
    valueFormatter,
    badgeColorClass
}) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    return (
        <div
            className={`rounded-xl border shadow-md backdrop-blur-xl transition-all duration-300 ${isDarkMode
                ? "bg-gradient-to-br from-slate-900/90 via-[#8091A1]/15 to-slate-950 border-[#8091A1]/30 shadow-lg shadow-slate-950/20"
                : "bg-gradient-to-br from-[#8091A1]/15 via-[#8091A1]/10 to-white/90 border-[#8091A1]/30 shadow-md text-slate-900"
                }`}
        >
            {/* Collapsible Accordion Header */}
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full p-3.5 flex items-center justify-between cursor-pointer select-none"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {title}
                    </h2>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColorClass}`}>
                        {categoryLabel}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
                    <span className="text-[10px] font-medium hidden sm:inline">
                        {isCollapsed ? "Expand Podium" : "Collapse"}
                    </span>
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                    />
                </div>
            </button>

            {/* Accordion Content Body */}
            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden px-3.5 pb-3.5"
                    >
                        <div className="flex items-end justify-center px-0 pt-2 pb-1 min-h-[165px] w-full gap-1.5">
                            {podiumData.map((bd, idx) => {
                                const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                                const isGold = rank === 1;
                                const isSilver = rank === 2;
                                const isBronze = rank === 3;
                                const { primary } = valueFormatter(bd);

                                return (
                                    <div
                                        key={rank}
                                        className={`flex flex-col items-center justify-between w-1/3 max-w-[280px] p-2.5 text-center transition-all duration-300 ${isGold
                                            ? isDarkMode
                                                ? "h-[165px] bg-gradient-to-b from-amber-500/35 via-slate-900 to-slate-950 border-t-2 border-x border-amber-500/80 shadow-2xl shadow-amber-500/25 z-10 rounded-t-2xl"
                                                : "h-[165px] bg-gradient-to-b from-amber-500/25 via-amber-50/80 to-white border-t-2 border-x border-amber-400 shadow-2xl shadow-amber-400/30 z-10 rounded-t-2xl"
                                            : isSilver
                                                ? isDarkMode
                                                    ? "h-[138px] bg-gradient-to-b from-slate-300/30 via-slate-900 to-slate-950 border-t border-l border-b border-slate-400/70 rounded-tl-2xl shadow-lg"
                                                    : "h-[138px] bg-gradient-to-b from-slate-200/90 via-slate-50 to-white border-t border-l border-b border-slate-300 rounded-tl-2xl shadow-md"
                                                : isDarkMode
                                                    ? "h-[118px] bg-gradient-to-b from-amber-700/30 via-slate-900 to-slate-950 border-t border-r border-b border-amber-700/70 rounded-tr-2xl shadow-lg"
                                                    : "h-[118px] bg-gradient-to-b from-amber-100/80 via-amber-50/50 to-white border-t border-r border-b border-amber-300/90 rounded-tr-2xl shadow-md"
                                            }`}
                                    >
                                        {/* Rank Header at top with increased height & prominent icon */}
                                        <div className="pt-1 flex flex-col items-center justify-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                                {isGold && <Trophy className="w-5 h-5 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.9)] shrink-0 animate-bounce" />}
                                                {isSilver && <Medal className="w-4 h-4 text-slate-300 shrink-0" />}
                                                {isBronze && <Award className="w-4 h-4 text-amber-600 shrink-0" />}
                                                <span
                                                    className={`text-sm sm:text-base font-black tracking-tight ${isGold ? "text-amber-400 drop-shadow-xs" : isSilver ? (isDarkMode ? "text-slate-200" : "text-slate-800") : "text-amber-600"
                                                        }`}
                                                >
                                                    #{rank}
                                                </span>
                                            </div>
                                        </div>

                                        {/* BD Name as Main Center Highlight */}
                                        <div className="flex items-center justify-center w-full my-auto py-1">
                                            <h3
                                                className={`text-xs sm:text-sm md:text-base font-black tracking-tight leading-snug line-clamp-2 max-w-[200px] w-full text-center px-0.5 ${isDarkMode ? "text-white drop-shadow-xs" : "text-slate-950 font-black"
                                                    }`}
                                            >
                                                {bd ? bd.name : "-"}
                                            </h3>
                                        </div>

                                        {/* Score / Percentage Badge */}
                                        <div className={`w-full pt-1.5 pb-0.5 border-t ${isDarkMode ? "border-slate-800/80" : "border-slate-200/90"}`}>
                                            <div className="text-sm sm:text-base font-black text-cyan-400 tracking-tight">{primary}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const POLLING_OPTIONS = [
    { label: "2 min", value: 2 * 60 },
    { label: "5 min", value: 5 * 60 },
    { label: "10 min", value: 10 * 60 },
    { label: "20 min", value: 20 * 60 },
    { label: "30 min", value: 30 * 60 }
];

export interface UnifiedLeaderboardViewProps {
    showTargetsAndActuals?: boolean;
    enableAnimations?: boolean;
}

export function UnifiedLeaderboardView({
    showTargetsAndActuals = true,
    enableAnimations = true
}: UnifiedLeaderboardViewProps) {
    const [month, setMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

    // Polling state (default 5 minutes = 300s)
    const [pollIntervalSeconds, setPollIntervalSeconds] = useState<number>(300);
    const [secondsUntilNextFetch, setSecondsUntilNextFetch] = useState<number>(300);

    // Track previous rankings to detect score updates & trigger celebration events
    const prevRankingsMap = useRef<Map<string, number>>(new Map());
    const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);

    // FIFO Queue for rocket celebration events so rockets launch sequentially (2 mins each)
    const celebrationQueue = useRef<CelebrationEvent[]>([]);
    const isRocketActiveRef = useRef<boolean>(false);

    // Dynamic X-Position state for rocket spawn (varies between 15% and 85% horizontal offset)
    const [rocketXPos, setRocketXPos] = useState<string>("50%");

    const launchCelebrationEvent = (event: CelebrationEvent) => {
        triggerConfettiEffect();
        if (!isRocketActiveRef.current) {
            isRocketActiveRef.current = true;
            const randomX = Math.floor(Math.random() * 70) + 15;
            setRocketXPos(`${randomX}%`);
            setActiveCelebration(event);
        } else {
            celebrationQueue.current.push(event);
        }
    };

    const handleRocketAnimationComplete = () => {
        if (celebrationQueue.current.length > 0) {
            const nextEvent = celebrationQueue.current.shift()!;
            const randomX = Math.floor(Math.random() * 70) + 15;
            setRocketXPos(`${randomX}%`);
            setActiveCelebration(nextEvent);
        } else {
            isRocketActiveRef.current = false;
            setActiveCelebration(null);
        }
    };

    // First session bomb explosion reveal state
    const [showBombExplosion, setShowBombExplosion] = useState<boolean>(false);
    const [bombExploded, setBombExploded] = useState<boolean>(false);

    useEffect(() => {
        if (enableAnimations && typeof window !== "undefined") {
            const hasSeenExplosion = sessionStorage.getItem("hasSeenLeaderboardIntro");
            if (!hasSeenExplosion) {
                setShowBombExplosion(true);
                sessionStorage.setItem("hasSeenLeaderboardIntro", "true");
                // Trigger explosion sequence
                const timer = setTimeout(() => {
                    setBombExploded(true);
                    triggerConfettiEffect();
                    const hideTimer = setTimeout(() => {
                        setShowBombExplosion(false);
                    }, 1200);
                    return () => clearTimeout(hideTimer);
                }, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [enableAnimations]);

    const triggerConfettiEffect = () => {
        if (!enableAnimations) return;
        try {
            confetti({
                particleCount: 120,
                spread: 90,
                origin: { y: 0.7 }
            });
        } catch {
            // Fallback silent fail if canvas missing
        }
    };

    // Dummy action handler: Move 5th position to 1st position, shifting ranks 1-4 downward by 1
    const triggerDummyRowShift = () => {
        if (!data?.rankings || data.rankings.length < 5) {
            if (data?.rankings && data.rankings.length >= 2) {
                // Fallback swap if fewer than 5 rows available
                const newRankings = [...data.rankings];
                const temp = newRankings[0];
                newRankings[0] = newRankings[1];
                newRankings[1] = temp;
                const tempRank = newRankings[0].rank;
                newRankings[0].rank = newRankings[1].rank;
                newRankings[1].rank = tempRank;
                setData({ ...data, rankings: newRankings });
            }
            return;
        }

        const currentList = [...data.rankings];
        // Remove 5th row (index 4)
        const fifthItem = currentList.splice(4, 1)[0];
        // Insert at 1st position (index 0)
        currentList.unshift(fifthItem);

        // Re-assign rank numbers 1 to N sequentially so Framer Motion / TanStack animate rank promotion cleanly
        const reRankedList = currentList.map((item, idx) => ({
            ...item,
            rank: idx + 1
        }));

        setData({
            ...data,
            rankings: reRankedList,
            monthlyTopThree: {
                first: reRankedList[0] || null,
                second: reRankedList[1] || null,
                third: reRankedList[2] || null
            }
        });
    };


    const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/public/bde-leaderboard?month=${month}&category=${encodeURIComponent(
                    selectedCategory
                )}`
            );
            if (!res.ok) {
                throw new Error("Failed to fetch leaderboard data");
            }
            const json = await res.json();
            if (json.success && json.data) {
                const newData: ApiData = json.data;

                // Detect new IPD conversions by comparing actual counts (Only if animations enabled)
                if (enableAnimations && prevRankingsMap.current.size > 0 && newData.rankings) {
                    for (const item of newData.rankings) {
                        const prevActual = prevRankingsMap.current.get(item.userId);
                        if (prevActual !== undefined && item.actual > prevActual) {
                            // Enqueue Live Celebratory Event & Rocket Animation
                            const event: CelebrationEvent = {
                                id: `${item.userId}-${Date.now()}`,
                                bdName: item.name,
                                category: item.category,
                                newActual: item.actual,
                                timestamp: new Date()
                            };
                            launchCelebrationEvent(event);
                            break;
                        }
                    }
                }

                // Store current actual counts in prevRankingsMap
                const newMap = new Map<string, number>();
                if (newData.rankings) {
                    newData.rankings.forEach((r) => newMap.set(r.userId, r.actual));
                }
                prevRankingsMap.current = newMap;

                setData(newData);
            } else {
                throw new Error(json.error || "Invalid response format");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
            setSecondsUntilNextFetch(pollIntervalSeconds);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month, selectedCategory]);

    // Polling timer effect
    useEffect(() => {
        setSecondsUntilNextFetch(pollIntervalSeconds);
        const interval = setInterval(() => {
            setSecondsUntilNextFetch((prev) => {
                if (prev <= 1) {
                    fetchData(true);
                    return pollIntervalSeconds;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [pollIntervalSeconds, month, selectedCategory]);

    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const filteredLeaderboard = useMemo(() => {
        if (!data?.rankings) return [];
        if (!searchQuery.trim()) return data.rankings;
        const q = searchQuery.toLowerCase();
        return data.rankings.filter(
            (b) =>
                b.name.toLowerCase().includes(q) ||
                b.category.toLowerCase().includes(q)
        );
    }, [data?.rankings, searchQuery]);

    // Derive Monthly Top 3 in stepped order: [2nd (Left), 1st (Center), 3rd (Right)]
    const monthlyPodium = useMemo(() => {
        if (!data?.monthlyTopThree) return [null, null, null];
        return [
            data.monthlyTopThree.second,
            data.monthlyTopThree.first,
            data.monthlyTopThree.third,
        ];
    }, [data?.monthlyTopThree]);

    // Definition of DataTable columns using TanStack Table API
    const columns = useMemo<ColumnDef<ApiLeaderboardEntry>[]>(() => {
        const cols: ColumnDef<ApiLeaderboardEntry>[] = [
            {
                accessorKey: "rank",
                header: "Rank",
                meta: {
                    headerClassName: "text-center w-20 !py-2 !px-3",
                    cellClassName: "text-center font-bold !py-1.5 !px-3"
                },
                cell: ({ row }) => {
                    const rank = row.original.rank;
                    if (rank === 1) {
                        return (
                            <span className="inline-flex items-center justify-center gap-1 font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">
                                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>1</span>
                            </span>
                        );
                    }
                    if (rank === 2) {
                        return (
                            <span className={`inline-flex items-center justify-center gap-1 font-black ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                                <Medal className="w-4 h-4 text-slate-300 shrink-0" />
                                <span>2</span>
                            </span>
                        );
                    }
                    if (rank === 3) {
                        return (
                            <span className="inline-flex items-center justify-center gap-1 font-black text-amber-600">
                                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>3</span>
                            </span>
                        );
                    }
                    return (
                        <span className={isDarkMode ? "text-slate-400 font-semibold" : "text-slate-600 font-semibold"}>
                            {rank}
                        </span>
                    );
                }
            },
            {
                accessorKey: "name",
                header: "BDE Executive",
                meta: {
                    headerClassName: "!py-2 !px-3",
                    cellClassName: "!py-2 !px-3"
                },
                cell: ({ row }) => {
                    const item = row.original;
                    return (
                        <div className="flex items-center gap-2.5">
                            <div
                                className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs ${isDarkMode
                                    ? "bg-slate-800 border-slate-700 text-slate-200 group-hover:border-cyan-500/50"
                                    : "bg-slate-100 border-slate-300 text-slate-800 group-hover:border-cyan-600/50"
                                    }`}
                            >
                                {item.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div
                                    className={`font-semibold transition-colors ${isDarkMode
                                        ? "text-white group-hover:text-cyan-300"
                                        : "text-slate-900 group-hover:text-cyan-700"
                                        }`}
                                >
                                    {item.name}
                                </div>
                            </div>
                        </div>
                    );
                }
            },
            {
                accessorKey: "category",
                header: "Category / Dept",
                meta: {
                    headerClassName: "!py-2 !px-3",
                    cellClassName: "!py-1.5 !px-3"
                },
                cell: ({ row }) => {
                    const getCategoryPillStyle = (category: string, isDark: boolean) => {
                        const lightPastelPalettes = [
                            { light: "bg-emerald-100 text-emerald-800 border-emerald-300/80", dark: "bg-emerald-950/80 text-emerald-300 border-emerald-700/70" },
                            { light: "bg-sky-100 text-sky-800 border-sky-300/80", dark: "bg-sky-950/80 text-sky-300 border-sky-700/70" },
                            { light: "bg-purple-100 text-purple-800 border-purple-300/80", dark: "bg-purple-950/80 text-purple-300 border-purple-700/70" },
                            { light: "bg-rose-100 text-rose-800 border-rose-300/80", dark: "bg-rose-950/80 text-rose-300 border-rose-700/70" },
                            { light: "bg-amber-100 text-amber-900 border-amber-300/80", dark: "bg-amber-950/80 text-amber-300 border-amber-700/70" },
                            { light: "bg-indigo-100 text-indigo-800 border-indigo-300/80", dark: "bg-indigo-950/80 text-indigo-300 border-indigo-700/70" },
                            { light: "bg-teal-100 text-teal-800 border-teal-300/80", dark: "bg-teal-950/80 text-teal-300 border-teal-700/70" },
                            { light: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300/80", dark: "bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-700/70" },
                            { light: "bg-orange-100 text-orange-900 border-orange-300/80", dark: "bg-orange-950/80 text-orange-300 border-orange-700/70" },
                            { light: "bg-cyan-100 text-cyan-900 border-cyan-300/80", dark: "bg-cyan-950/80 text-cyan-300 border-cyan-700/70" },
                            { light: "bg-blue-100 text-blue-900 border-blue-300/80", dark: "bg-blue-950/80 text-blue-300 border-blue-700/70" },
                            { light: "bg-lime-100 text-lime-900 border-lime-300/80", dark: "bg-lime-950/80 text-lime-300 border-lime-700/70" },
                        ];
                        let hash = 0;
                        for (let i = 0; i < (category || "").length; i++) {
                            hash = category.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const index = Math.abs(hash) % lightPastelPalettes.length;
                        const palette = lightPastelPalettes[index];
                        return isDark ? palette.dark : palette.light;
                    };

                    return (
                        <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-xs inline-flex items-center gap-1.5 ${getCategoryPillStyle(
                                row.original.category,
                                isDarkMode
                            )}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
                            <span>{row.original.category}</span>
                        </span>
                    );
                }
            }
        ];

        if (showTargetsAndActuals) {
            cols.push(
                {
                    accessorKey: "targetValue",
                    header: "IPD Target",
                    meta: {
                        headerClassName: "text-right !py-2 !px-3",
                        cellClassName: "text-right font-medium !py-1.5 !px-3"
                    },
                    cell: ({ row }) => (
                        <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>
                            {row.original.targetValue}
                        </span>
                    )
                },
                {
                    accessorKey: "actual",
                    header: "IPD Done",
                    meta: {
                        headerClassName: "text-right !py-2 !px-3",
                        cellClassName: "text-right font-bold !py-1.5 !px-3"
                    },
                    cell: ({ row }) => (
                        <span className={isDarkMode ? "text-white" : "text-slate-900"}>
                            {row.original.actual}
                        </span>
                    )
                }
            );
        }

        cols.push({
            accessorKey: "percentage",
            header: "Target Achieved %",
            meta: {
                headerClassName: "min-w-[200px] !py-2 !px-3",
                cellClassName: "!py-1 !px-3"
            },
            cell: ({ row }) => {
                const item = row.original;
                const percentColor =
                    item.percentage >= 100
                        ? "text-emerald-500"
                        : item.percentage >= 75
                            ? "text-cyan-500"
                            : item.percentage >= 50
                                ? "text-amber-500"
                                : "text-rose-500";

                const barBg =
                    item.percentage >= 100
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : item.percentage >= 75
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                            : item.percentage >= 50
                                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gradient-to-r from-rose-500 to-red-500";

                return (
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className={`font-extrabold ${percentColor}`}>
                                {item.percentage}%
                            </span>
                            {showTargetsAndActuals && (
                                <span className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                    {item.actual} / {item.targetValue}
                                </span>
                            )}
                        </div>
                        <div
                            className={`w-full h-1.5 rounded-full overflow-hidden border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-200 border-slate-300"
                                }`}
                        >
                            <div
                                className={`h-full ${barBg} transition-all duration-500 rounded-full`}
                                style={{
                                    width: `${Math.min(item.percentage, 100)}%`
                                }}
                            />
                        </div>
                    </div>
                );
            }
        });

        return cols;
    }, [isDarkMode, showTargetsAndActuals]);

    return (
        <div
            className={`min-h-screen font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden pb-16 transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
                }`}
        >
            {/* First Session Bomb Explosion Reveal Overlay */}
            <AnimatePresence>
                {enableAnimations && showBombExplosion && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl pointer-events-none"
                    >
                        {!bombExploded ? (
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0.3 }}
                                animate={{ scale: [0.5, 1.2, 1], opacity: 1, rotate: [0, -10, 10, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity, repeatType: "mirror" }}
                                className="flex flex-col items-center gap-3"
                            >
                                <div className="text-6xl animate-bounce">💣</div>
                                <div className="text-lg font-black tracking-widest text-amber-400 uppercase animate-pulse">
                                    PREPARING LEADERBOARD...
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ scale: 0.3, opacity: 1 }}
                                animate={{ scale: [0.3, 1.8, 3.5], opacity: [1, 0.8, 0] }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                className="w-32 h-32 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 shadow-[0_0_60px_rgba(245,158,11,0.9)] flex items-center justify-center text-4xl"
                            >
                                💥
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Background Decorative Mesh / Ambient Lights */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl ${isDarkMode ? "bg-cyan-600/20" : "bg-cyan-500/15"
                        }`}
                />
                <div
                    className={`absolute top-1/3 -right-40 w-96 h-96 rounded-full blur-3xl ${isDarkMode ? "bg-emerald-600/15" : "bg-emerald-500/15"
                        }`}
                />
                <div
                    className={`absolute bottom-10 left-1/3 w-96 h-96 rounded-full blur-3xl ${isDarkMode ? "bg-blue-600/15" : "bg-blue-400/15"
                        }`}
                />
                <div
                    className={`absolute inset-0 bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:24px_24px] ${isDarkMode ? "opacity-30" : "opacity-15"
                        }`}
                />
            </div>

            {/* Floating Rocket Energy Boost Overlay: Step-by-Step Orthogonal (Up then Sideways) 2-minute Motion */}
            <AnimatePresence>
                {enableAnimations && activeCelebration && (
                    <motion.div
                        key={activeCelebration.id}
                        initial={{ y: "115vh", x: "0vw", opacity: 0, scale: 0.9 }}
                        animate={{
                            // Step 1: Up, Step 2: Sideways, Step 3: Up, Step 4: Sideways... strictly orthogonal!
                            y: [
                                "115vh", "75vh", "75vh", "55vh", "55vh", "35vh", "35vh", "20vh", "20vh", "40vh", "40vh", "15vh", "15vh", "-30vh"
                            ],
                            x: [
                                "0vw",   "0vw",  "-20vw", "-20vw", "25vw",  "25vw",  "-15vw", "-15vw", "20vw",  "20vw",  "-10vw", "-10vw", "10vw",  "10vw"
                            ],
                            opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                            scale: [0.9, 1.1, 1.05, 1, 1.05, 1, 1.05, 1, 1.05, 1, 1.05, 1, 1, 0.8]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 120,
                            ease: "easeInOut",
                            times: [0, 0.02, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94, 0.97, 1]
                        }}
                        style={{ left: rocketXPos }}
                        onAnimationComplete={handleRocketAnimationComplete}
                        className="fixed -translate-x-1/2 z-[9999] pointer-events-none flex items-center gap-3 opacity-100"
                    >
                        {/* Single Large Rocket Unit with Rear Fumes Trailing Below */}
                        <div className="flex flex-col items-center relative drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
                            {/* Rocket Body */}
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 border-2 border-white shadow-[0_0_45px_rgba(239,68,68,1)] flex items-center justify-center animate-bounce z-10">
                                <Rocket className="w-10 h-10 text-white fill-white transform -rotate-45 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
                            </div>
                            {/* Trailing Fire & Fumes Particle Stream */}
                            <div className="w-5 h-28 -mt-2 bg-gradient-to-t from-transparent via-amber-500 via-orange-500 to-yellow-300 blur-xs rounded-full animate-pulse border-x border-orange-500/80 shadow-[0_0_25px_rgba(245,158,11,0.9)]" />
                        </div>

                        {/* Small Compact BD Info Card (Solid background, z-[9999] high visibility) */}
                        <div className="px-4 py-2.5 rounded-xl bg-[#FFFBEB] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.5)] border-2 border-amber-400 flex flex-col gap-0.5 opacity-100">
                            <div className="text-xs font-black text-slate-950 tracking-tight leading-tight">
                                {activeCelebration.bdName}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 leading-tight">
                                {activeCelebration.category}
                            </div>
                            <div className="text-[11px] font-extrabold text-emerald-900 bg-emerald-200/90 px-2 py-0.5 rounded border border-emerald-400 w-fit mt-0.5 flex items-center gap-1 shadow-xs">
                                <span>🚀</span>
                                <span>has done more IPDs</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-1">
                {/* Header Bar */}
                <header
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-xl ${isDarkMode
                        ? "bg-slate-900/60 border-slate-800/80 shadow-cyan-950/20"
                        : "bg-[#062D4C] border-[#062D4C] shadow-slate-400/30 text-white"
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="relative w-20 h-10 sm:w-36 sm:h-12 shrink-0">
                            <Image
                                src={logo}
                                alt="Mediend Logo"
                                fill
                                className="object-contain object-left"
                                priority
                            />
                        </div>
                        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                            Leaderboard
                        </h1>
                    </div>

                    {/* Controls: Month + Category + Refresh Interval Config + Theme Toggle + Refresh */}
                    <div className="flex flex-wrap items-center gap-3">

                        {/* Month Filter */}
                        <div
                            className={`relative flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${isDarkMode
                                ? "bg-slate-900 border-slate-700 text-cyan-300 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500/50"
                                : "bg-white border-slate-300 text-slate-900 shadow-sm focus-within:border-cyan-600 focus-within:ring-1 focus-within:ring-cyan-500/30"
                                }`}
                        >
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setMonth(e.target.value);
                                    }
                                }}
                                className={`bg-transparent outline-none cursor-pointer text-xs font-bold w-full ${isDarkMode ? "text-cyan-300 [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"
                                    }`}
                            />
                        </div>

                        {/* Category Filter */}
                        <div
                            className={`relative flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all max-w-[200px] ${isDarkMode
                                ? "bg-slate-900 border-slate-700 text-emerald-300 focus-within:border-emerald-400"
                                : "bg-white border-slate-300 text-slate-900 shadow-sm focus-within:border-emerald-600"
                                }`}
                        >
                            <Filter className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`} />
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className={`bg-transparent outline-none cursor-pointer pr-1 text-xs font-bold truncate w-full ${isDarkMode ? "text-emerald-300" : "text-slate-900"
                                    }`}
                            >
                                <option value="ALL" className={isDarkMode ? "bg-slate-900 text-slate-200" : "bg-white text-slate-900"}>
                                    All Categories
                                </option>
                                {data?.categories?.map((cat) => (
                                    <option key={cat} value={cat} className={isDarkMode ? "bg-slate-900 text-slate-200" : "bg-white text-slate-900"}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Refresh Interval Config Dropdown */}
                        <div
                            className={`relative flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${isDarkMode
                                ? "bg-slate-900 border-slate-700 text-cyan-300"
                                : "bg-white border-slate-300 text-slate-900 shadow-sm"
                                }`}
                        >
                            <select
                                value={pollIntervalSeconds}
                                onChange={(e) => setPollIntervalSeconds(Number(e.target.value))}
                                className={`bg-transparent outline-none cursor-pointer pr-1 text-xs font-bold ${isDarkMode ? "text-cyan-300" : "text-slate-900"
                                    }`}
                            >
                                {POLLING_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value} className={isDarkMode ? "bg-slate-900 text-slate-200" : "bg-white text-slate-900"}>
                                        Refresh: {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Light / Dark Mode Toggle */}
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            className={`p-2 rounded-lg border transition-all active:scale-95 ${isDarkMode
                                ? "bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700"
                                : "bg-white hover:bg-slate-100 text-amber-500 border-slate-300 shadow-sm"
                                }`}
                        >
                            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </button>

                        {/* Refresh Button + Live Timer Indicator */}
                        <button
                            onClick={() => fetchData(false)}
                            title={`Click to refresh data now (Next auto-sync in ${formatCountdown(secondsUntilNextFetch)})`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95 ${isDarkMode
                                ? "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm"
                                }`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
                            <span className="text-[11px] font-mono text-cyan-400">
                                {formatCountdown(secondsUntilNextFetch)}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Top Stepped Podium Card: Single Monthly Champions View */}
                <div className="w-full">
                    <SteppedPodiumCard
                        title={`Monthly Champions (${month})`}
                        icon={<Trophy className="w-4 h-4 text-cyan-500" />}
                        categoryLabel={selectedCategory === "ALL" ? "All Categories" : selectedCategory}
                        podiumData={monthlyPodium}
                        isDarkMode={isDarkMode}
                        badgeColorClass={
                            isDarkMode
                                ? "bg-cyan-950/80 text-cyan-300 border-cyan-800/60"
                                : "bg-cyan-100/80 text-cyan-800 border-cyan-200"
                        }
                        valueFormatter={(bd) => ({
                            primary: bd ? `${bd.percentage}%` : "-",
                            secondary: bd ? `${bd.actual} / ${bd.targetValue}` : "-"
                        })}
                    />
                </div>

                {/* Main Rankings Table Container using Generic DataTable */}
                <div
                    className={`rounded-2xl border shadow-xl overflow-hidden backdrop-blur-xl ${isDarkMode
                        ? "bg-gradient-to-br from-slate-900/90 via-[#8091A1]/15 to-slate-950 border-[#8091A1]/30 shadow-2xl shadow-slate-950/30"
                        : "bg-gradient-to-br from-[#8091A1]/15 via-[#8091A1]/10 to-white/95 border-[#8091A1]/30 shadow-lg text-slate-900"
                        }`}
                >
                    {/* Table Header Controls */}
                    <div
                        className={`px-4 py-2.5 border-b flex flex-col md:flex-row items-center justify-between gap-3 ${isDarkMode ? "border-[#8091A1]/30 bg-[#8091A1]/10" : "border-[#8091A1]/20 bg-[#8091A1]/10"
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-cyan-500" />
                            <h2 className={`text-base font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                Full BDE Standings
                            </h2>
                            <span className={`text-xs font-normal ml-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                ({filteredLeaderboard.length} Executives)
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-72">
                            <Search
                                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-slate-400" : "text-slate-500"
                                    }`}
                            />
                            <input
                                type="text"
                                placeholder="Search BDE or category..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full rounded-xl border pl-9 pr-4 py-1.5 text-xs transition-all outline-none ${isDarkMode
                                    ? "bg-slate-950/80 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-cyan-500"
                                    : "bg-white/90 border-[#8091A1]/30 text-slate-900 placeholder-slate-400 focus:border-[#8091A1] shadow-xs"
                                    }`}
                            />
                        </div>
                    </div>

                    {/* TanStack DataTable with Smooth Sliding Row Animations */}
                    <div className="p-1.5">
                        <DataTable
                            columns={columns}
                            data={filteredLeaderboard}
                            isLoading={loading}
                            emptyMessage="No business development executives found matching your criteria."
                            enablePagination={true}
                            initialPageSize={10}
                            pageSizeOptions={[10, 25, 50]}
                            getRowId={(row) => row.userId}
                            tableHeaderClassName={
                                isDarkMode
                                    ? "bg-slate-950/90 border-slate-800/80 text-slate-300 font-bold"
                                    : "bg-[#062D4C] border-[#062D4C] text-white font-bold [&_th]:text-white [&_th]:font-bold shadow-md"
                            }
                            tableContainerClassName="border-0 shadow-none bg-transparent"
                            rowClassName={(row) => {
                                const rank = row.rank;
                                const transitionClass = enableAnimations ? "transition-all duration-500 ease-in-out" : "";
                                if (rank === 1) {
                                    return isDarkMode
                                        ? `bg-gradient-to-r from-amber-500/35 via-amber-500/20 to-amber-500/10 border-amber-500/50 hover:bg-amber-500/40 shadow-md shadow-amber-500/15 ${transitionClass}`
                                        : `bg-gradient-to-r from-amber-500/25 via-amber-200/50 to-amber-100/30 border-amber-400/80 hover:bg-amber-500/30 shadow-md shadow-amber-400/20 ${transitionClass}`;
                                }
                                if (rank === 2) {
                                    return isDarkMode
                                        ? `bg-gradient-to-r from-slate-300/30 via-slate-400/20 to-slate-400/10 border-slate-400/50 hover:bg-slate-300/35 ${transitionClass}`
                                        : `bg-gradient-to-r from-slate-300/60 via-slate-200/50 to-slate-100/40 border-slate-300 hover:bg-slate-200/70 ${transitionClass}`;
                                }
                                if (rank === 3) {
                                    return isDarkMode
                                        ? `bg-gradient-to-r from-amber-700/30 via-amber-800/20 to-amber-800/10 border-amber-700/50 hover:bg-amber-700/35 ${transitionClass}`
                                        : `bg-gradient-to-r from-amber-200/60 via-orange-100/40 to-orange-50/30 border-amber-300/80 hover:bg-amber-100/70 ${transitionClass}`;
                                }
                                return isDarkMode
                                    ? `hover:bg-slate-800/40 border-slate-800/60 ${transitionClass}`
                                    : `hover:bg-slate-100/60 border-slate-200 ${transitionClass}`;
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    return <UnifiedLeaderboardView showTargetsAndActuals={false} enableAnimations={true} />;
}
