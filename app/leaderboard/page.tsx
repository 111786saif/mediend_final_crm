"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
    Trophy,
    Award,
    Medal,
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
            className={`rounded-2xl border transition-all duration-300 ${isDarkMode
                ? "bg-slate-900/90 border-slate-800 shadow-xl"
                : "bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-slate-900"
                }`}
        >
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
            >
                <div className="flex items-center gap-2.5">
                    {icon}
                    <h2 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                        {title}
                    </h2>
                    <span className={`text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${badgeColorClass}`}>
                        {categoryLabel}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
                    <span className="text-xs font-semibold hidden sm:inline">
                        {isCollapsed ? "Expand" : "Collapse"}
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
                        className="overflow-hidden px-4 sm:px-6 pb-6 pt-2"
                    >
                        {/* Podium Container with Stepped Pedestals matching reference image */}
                        <div className="relative flex items-end justify-center w-full max-w-4xl mx-auto min-h-[180px]">
                            {podiumData.map((bd, idx) => {
                                const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                                const isGold = rank === 1;
                                const isSilver = rank === 2;
                                const isBronze = rank === 3;
                                const { primary, secondary } = valueFormatter(bd);

                                return (
                                    <div
                                        key={rank}
                                        className={`relative flex flex-col items-center justify-between transition-all duration-300 ${isGold ? "w-[38%] z-20 -mx-1" : "w-[31%] z-10"
                                            }`}
                                    >
                                        {/* Floating Champion Card */}
                                        <div
                                            className={`w-full rounded-2xl p-1.5 sm:p-2 flex flex-col items-center justify-between text-center border transition-all duration-300 ${isGold
                                                ? isDarkMode
                                                    ? "bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-900 border-amber-400/80 shadow-amber-500/10 min-h-[120px]"
                                                    : "bg-[#FFFDEB] border-[#FDE68A] shadow-[0_6px_16px_rgba(245,158,11,0.12)] min-h-[120px]"
                                                : isSilver
                                                    ? isDarkMode
                                                        ? "bg-gradient-to-b from-slate-800/80 via-slate-900 to-slate-900 border-slate-700 shadow-slate-900/50 min-h-[105px]"
                                                        : "bg-[#F1F5F9]/90 border-[#CBD5E1] shadow-[0_4px_12px_rgba(100,116,139,0.08)] min-h-[105px]"
                                                    : isDarkMode
                                                        ? "bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-900 border-amber-800/60 shadow-amber-950/30 min-h-[105px]"
                                                        : "bg-[#FFF7ED]/90 border-[#FED7AA] shadow-[0_4px_12px_rgba(234,88,12,0.08)] min-h-[105px]"
                                                }`}
                                        >
                                            {/* Circular Laurel Rank Badge with Laurel Leaf Emojis */}
                                            <div className="relative flex items-center justify-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-2xl sm:text-3xl select-none transform -scale-x-100 leading-none">🌿</span>

                                                    <div
                                                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-lg sm:text-xl border-2 shadow-inner shrink-0 ${isGold
                                                            ? "bg-gradient-to-b from-amber-300 to-amber-500 border-amber-200 text-slate-950 shadow-amber-500/40"
                                                            : isSilver
                                                                ? "bg-gradient-to-b from-slate-200 to-slate-400 border-slate-100 text-slate-950"
                                                                : "bg-gradient-to-b from-amber-500 to-amber-700 border-amber-400 text-white"
                                                            }`}
                                                    >
                                                        {rank}
                                                    </div>

                                                    <span className="text-2xl sm:text-3xl select-none leading-none">🌿</span>
                                                </div>
                                            </div>

                                            {/* BD Executive Name */}
                                            <h3
                                                className={`text-base sm:text-lg font-black tracking-tight leading-tight line-clamp-1 max-w-full px-1 my-0.5 ${isDarkMode ? "text-slate-100" : "text-[#0F172A]"
                                                    }`}
                                            >
                                                {bd ? bd.name : "-"}
                                            </h3>

                                            {/* Target Percentage */}
                                            <div className="flex flex-col items-center w-full pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                                <span className={`text-lg sm:text-2xl font-black tracking-tight leading-none ${isDarkMode ? "text-cyan-400" : "text-[#0284C7]"}`}>
                                                    {primary}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stepped Pedestal Base */}
                                        <div
                                            className={`w-full rounded-b-xl transition-all ${isGold
                                                ? isDarkMode
                                                    ? "h-7 bg-gradient-to-b from-amber-500 to-amber-600 shadow-lg border-t border-amber-300/40"
                                                    : "h-7 bg-gradient-to-b from-[#FCD34D] to-[#F59E0B] shadow-md border-t border-amber-200"
                                                : isSilver
                                                    ? isDarkMode
                                                        ? "h-5 bg-gradient-to-b from-slate-700 to-slate-800 border-t border-slate-600"
                                                        : "h-5 bg-gradient-to-b from-[#CBD5E1] to-[#94A3B8] shadow-sm border-t border-slate-200"
                                                    : isDarkMode
                                                        ? "h-4 bg-gradient-to-b from-amber-800 to-amber-900 border-t border-amber-700"
                                                        : "h-4 bg-gradient-to-b from-[#FDBA74] to-[#EA580C] shadow-sm border-t border-amber-200"
                                                }`}
                                        />
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
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

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
        return data?.rankings || [];
    }, [data?.rankings]);

    // Top 3 ranked executives (Fixed at the top of the standings table)
    const topThreeStandings = useMemo(() => {
        return filteredLeaderboard.filter((b) => b.rank <= 3);
    }, [filteredLeaderboard]);

    // Executives from Rank 4 onwards where IPD done (actual) >= 1 (Vertical Auto-Scrolling Carousel)
    const scrollingStandings = useMemo(() => {
        return filteredLeaderboard.filter((b) => b.rank > 3 && b.actual >= 1);
    }, [filteredLeaderboard]);

    // Derive Monthly Top 3 in stepped order: [2nd (Left), 1st (Center), 3rd (Right)]
    const monthlyPodium = useMemo(() => {
        if (!data?.monthlyTopThree) return [null, null, null];
        return [
            data.monthlyTopThree.second,
            data.monthlyTopThree.first,
            data.monthlyTopThree.third,
        ];
    }, [data?.monthlyTopThree]);

    // Definition of DataTable columns matching reference design
    const columns = useMemo<ColumnDef<ApiLeaderboardEntry>[]>(() => {
        const cols: ColumnDef<ApiLeaderboardEntry>[] = [
            {
                accessorKey: "rank",
                header: "Rank",
                meta: {
                    headerClassName: "text-center w-24 !py-3 !px-4",
                    cellClassName: "text-center !py-2.5 !px-4"
                },
                cell: ({ row }) => {
                    const rank = row.original.rank;
                    if (rank === 1) {
                        return (
                            <div className="flex items-center justify-center gap-1">
                                <span className="text-sm font-black text-amber-500">👑</span>
                                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm border border-amber-200">
                                    1
                                </div>
                            </div>
                        );
                    }
                    if (rank === 2) {
                        return (
                            <div className="flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs border border-slate-100">
                                    2
                                </div>
                            </div>
                        );
                    }
                    if (rank === 3) {
                        return (
                            <div className="flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-500 to-amber-700 text-white font-black text-xs flex items-center justify-center shadow-xs border border-amber-400">
                                    3
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div className="flex items-center justify-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}>
                                {rank}
                            </div>
                        </div>
                    );
                }
            },
            {
                accessorKey: "name",
                header: "BDE",
                meta: {
                    headerClassName: "!py-3 !px-4",
                    cellClassName: "!py-2.5 !px-4"
                },
                cell: ({ row }) => {
                    const item = row.original;
                    return (
                        <div className={`font-extrabold text-sm tracking-tight ${isDarkMode ? "text-slate-100" : "text-[#0F172A]"}`}>
                            {item.name}
                        </div>
                    );
                }
            },
            {
                accessorKey: "category",
                header: "Category / Dept",
                meta: {
                    headerClassName: "!py-3 !px-4",
                    cellClassName: "!py-2.5 !px-4"
                },
                cell: ({ row }) => {
                    return (
                        <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 bg-[#0891B2] text-white shadow-xs border border-cyan-400/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-200 shrink-0" />
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
                        headerClassName: "text-right !py-3 !px-4",
                        cellClassName: "text-right font-medium !py-2.5 !px-4"
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
                        headerClassName: "text-right !py-3 !px-4",
                        cellClassName: "text-right font-bold !py-2.5 !px-4"
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
                headerClassName: "min-w-[240px] !py-3 !px-4",
                cellClassName: "!py-2 !px-4"
            },
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex items-center gap-4">
                        <span className="font-extrabold text-sm sm:text-base text-[#0284C7] dark:text-cyan-400 min-w-[50px]">
                            {item.percentage}%
                        </span>
                        <div
                            className={`w-full max-w-[220px] h-3 rounded-full overflow-hidden border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#E2E8F0] border-slate-300/60"
                                }`}
                        >
                            <div
                                className="h-full bg-gradient-to-r from-[#06B6D4] to-[#0284C7] transition-all duration-500 rounded-full"
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
            className={`min-h-screen font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden pb-16 transition-colors duration-300 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
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
                                "0vw", "0vw", "-20vw", "-20vw", "25vw", "25vw", "-15vw", "-15vw", "20vw", "20vw", "-10vw", "-10vw", "10vw", "10vw"
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

            {/* Fixed Full Width Reference Dark-Navy Header Bar */}
            <header
                className={`fixed top-0 inset-x-0 z-50 w-full flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-3 border-b shadow-md transition-colors ${isDarkMode
                    ? "bg-slate-900/95 border-slate-800 text-white backdrop-blur-md"
                    : "bg-[#0B2545] border-[#0B2545] text-white shadow-slate-950/20"
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className="relative w-28 h-9 sm:w-32 sm:h-10 shrink-0">
                        <Image
                            src={logo}
                            alt="Mediend Logo"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                        Leaderboard
                    </h1>
                </div>

                {/* Header Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Filter */}
                    <div className="relative flex items-center bg-white text-slate-900 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-extrabold shadow-sm">
                        <Calendar className="w-4 h-4 mr-2 text-slate-600 shrink-0" />
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setMonth(e.target.value);
                                }
                            }}
                            className="bg-transparent outline-none cursor-pointer text-xs font-extrabold text-slate-900 [color-scheme:light]"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="relative flex items-center bg-white text-slate-900 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-extrabold shadow-sm max-w-[200px]">
                        <Filter className="w-3.5 h-3.5 mr-2 text-cyan-600 shrink-0" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-transparent outline-none cursor-pointer pr-1 text-xs font-extrabold truncate w-full text-slate-900"
                        >
                            <option value="ALL" className="bg-white text-slate-900">
                                All Categories
                            </option>
                            {data?.categories?.map((cat) => (
                                <option key={cat} value={cat} className="bg-white text-slate-900">
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Interval Dropdown */}
                    <div className="relative flex items-center bg-white text-slate-900 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-extrabold shadow-sm">
                        <Clock className="w-3.5 h-3.5 mr-2 text-cyan-600 shrink-0" />
                        <select
                            value={pollIntervalSeconds}
                            onChange={(e) => setPollIntervalSeconds(Number(e.target.value))}
                            className="bg-transparent outline-none cursor-pointer pr-1 text-xs font-extrabold text-slate-900"
                        >
                            {POLLING_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
                                    Refresh: {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        className="p-2 rounded-xl bg-white text-amber-500 border border-slate-200 shadow-sm transition-all active:scale-95 hover:bg-slate-50"
                    >
                        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-amber-600" />}
                    </button>

                    {/* Live Timer Pill */}
                    <button
                        onClick={() => fetchData(false)}
                        title={`Click to refresh data now (Next auto-sync in ${formatCountdown(secondsUntilNextFetch)})`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-cyan-700 border border-slate-200 text-xs font-extrabold shadow-sm transition-all active:scale-95 hover:bg-slate-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-600" : "text-cyan-600"}`} />
                        <span className="text-xs font-mono font-bold text-cyan-700">
                            {formatCountdown(secondsUntilNextFetch)}
                        </span>
                    </button>
                </div>
            </header>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 space-y-3">

                {/* Top Stepped Podium Card */}
                <div className="w-full">
                    <SteppedPodiumCard
                        title={`MONTHLY CHAMPIONS (${month})`}
                        icon={<Trophy className="w-4 h-4 text-cyan-600" />}
                        categoryLabel={selectedCategory === "ALL" ? "All Categories" : selectedCategory}
                        podiumData={monthlyPodium}
                        isDarkMode={isDarkMode}
                        badgeColorClass={
                            isDarkMode
                                ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                                : "bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]"
                        }
                        valueFormatter={(bd) => ({
                            primary: bd ? `${bd.percentage}%` : "-",
                            secondary: bd ? `${bd.actual} / ${bd.targetValue}` : "-"
                        })}
                    />
                </div>

                {/* Main Rankings Table Container */}
                <div
                    className={`rounded-2xl border shadow-md overflow-hidden transition-all ${isDarkMode
                        ? "bg-slate-900 border-slate-800 shadow-xl"
                        : "bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] text-slate-900"
                        }`}
                >
                    {/* Table Header Controls */}
                    <div
                        className={`px-5 py-1.5 border-b flex items-center justify-between gap-2 ${isDarkMode ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-white"
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-base">👥</span>
                            <h2 className={`text-sm font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                MEDIEND SALES DEPARTMENT
                            </h2>
                        </div>
                    </div>

                    {/* BDE Standings Table: Fixed Top 3 Rows + Vertical Auto-Scrolling Carousel for Ranks >= 4 (IPD Actual >= 1) */}
                    <div className="overflow-hidden">
                        <table className="w-full table-fixed caption-bottom text-sm border-collapse">
                            {/* Column Width Definitions to Guarantee Exact Column Alignment */}
                            <colgroup>
                                <col className="w-20" />
                                <col className="w-[30%]" />
                                <col className="w-[20%]" />
                                {showTargetsAndActuals && (
                                    <>
                                        <col className="w-[12%]" />
                                        <col className="w-[12%]" />
                                    </>
                                )}
                                <col className="w-auto" />
                            </colgroup>

                            {/* Dark Navy Table Header */}
                            <thead className={isDarkMode ? "bg-slate-950 text-slate-300 font-bold text-xs uppercase" : "bg-[#062D4C] text-white font-extrabold text-xs uppercase shadow-md"}>
                                <tr>
                                    <th className="text-center py-3 px-3">Rank</th>
                                    <th className="text-left py-3 px-4">BDE</th>
                                    <th className="text-left py-3 px-4">Category / Dept</th>
                                    {showTargetsAndActuals && (
                                        <>
                                            <th className="text-right py-3 px-4">IPD Target</th>
                                            <th className="text-right py-3 px-4">IPD Done</th>
                                        </>
                                    )}
                                    <th className="text-left py-3 px-4">Target Achieved %</th>
                                </tr>
                            </thead>

                            {/* Section 1: Top 3 Fixed Rows */}
                            <tbody className="divide-y divide-border">
                                {topThreeStandings.map((item) => (
                                    <tr
                                        key={item.userId}
                                        className={`transition-colors ${item.rank === 1
                                            ? isDarkMode ? "bg-slate-800/80 hover:bg-slate-800" : "bg-amber-500/15 hover:bg-amber-500/25"
                                            : item.rank === 2
                                                ? isDarkMode ? "bg-slate-800/40 hover:bg-slate-800/60" : "bg-slate-100/70 hover:bg-slate-200/60"
                                                : isDarkMode ? "bg-slate-800/20 hover:bg-slate-800/40" : "bg-amber-100/50 hover:bg-amber-100/80"
                                            }`}
                                    >
                                        <td className="text-center py-2.5 px-4">
                                            {item.rank === 1 ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-sm font-black text-amber-500">👑</span>
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm border border-amber-200">
                                                        1
                                                    </div>
                                                </div>
                                            ) : item.rank === 2 ? (
                                                <div className="flex items-center justify-center">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs border border-slate-100">
                                                        2
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-500 to-amber-700 text-white font-black text-xs flex items-center justify-center shadow-xs border border-amber-400">
                                                        3
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 font-extrabold text-sm tracking-tight">
                                            <span className={isDarkMode ? "text-slate-100" : "text-[#0F172A]"}>{item.name}</span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 bg-[#0891B2] text-white shadow-xs border border-cyan-400/40">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-200 shrink-0" />
                                                <span>{item.category}</span>
                                            </span>
                                        </td>
                                        {showTargetsAndActuals && (
                                            <>
                                                <td className={`text-right py-2.5 px-4 font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                                                    {item.targetValue}
                                                </td>
                                                <td className={`text-right py-2.5 px-4 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                                    {item.actual}
                                                </td>
                                            </>
                                        )}
                                        <td className="py-2 px-4">
                                            <div className="flex items-center gap-4">
                                                <span className="font-extrabold text-sm sm:text-base text-[#0284C7] dark:text-cyan-400 min-w-[50px]">
                                                    {item.percentage}%
                                                </span>
                                                <div className={`w-full max-w-[220px] h-3 rounded-full overflow-hidden border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#E2E8F0] border-slate-300/60"}`}>
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[#06B6D4] to-[#0284C7] transition-all duration-500 rounded-full"
                                                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Section 2: Fixed Height Vertical Carousel Container for Ranks 4+ (364px = exactly 7 rows visible at once) */}
                        {scrollingStandings.length > 0 ? (
                            <div className="relative h-[364px] overflow-hidden border-t border-border">
                                <motion.div
                                    animate={{ y: [0, -scrollingStandings.length * 52] }}
                                    transition={{
                                        duration: Math.max(scrollingStandings.length * 3.5, 12),
                                        ease: "linear",
                                        repeat: Infinity,
                                    }}
                                    className="w-full"
                                >
                                    <table className="w-full table-fixed caption-bottom text-sm border-collapse">
                                        <colgroup>
                                            <col className="w-20" />
                                            <col className="w-[30%]" />
                                            <col className="w-[20%]" />
                                            {showTargetsAndActuals && (
                                                <>
                                                    <col className="w-[12%]" />
                                                    <col className="w-[12%]" />
                                                </>
                                            )}
                                            <col className="w-auto" />
                                        </colgroup>
                                        <tbody className="divide-y divide-border">
                                            {[...scrollingStandings, ...scrollingStandings].map((item, idx) => (
                                                <tr
                                                    key={`${item.userId}-${idx}`}
                                                    className={`h-[52px] transition-colors ${isDarkMode ? "border-slate-800/60 hover:bg-slate-800/40 text-slate-200" : "border-slate-100 hover:bg-slate-50 text-slate-900"
                                                        }`}
                                                >
                                                    <td className="text-center py-2.5 px-3">
                                                        <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center font-bold text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700 border border-slate-200"
                                                            }`}>
                                                            {item.rank}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4 font-extrabold text-sm tracking-tight truncate">
                                                        <span className={isDarkMode ? "text-slate-100" : "text-[#0F172A]"}>{item.name}</span>
                                                    </td>
                                                    <td className="py-2.5 px-4 truncate">
                                                        <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 bg-[#0891B2] text-white shadow-xs border border-cyan-400/40">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-200 shrink-0" />
                                                            <span className="truncate">{item.category}</span>
                                                        </span>
                                                    </td>
                                                    {showTargetsAndActuals && (
                                                        <>
                                                            <td className={`text-right py-2.5 px-4 font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                                                                {item.targetValue}
                                                            </td>
                                                            <td className={`text-right py-2.5 px-4 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                                                                {item.actual}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="py-2 px-4">
                                                        <div className="flex items-center gap-4">
                                                            <span className="font-extrabold text-sm sm:text-base text-[#0284C7] dark:text-cyan-400 min-w-[50px]">
                                                                {item.percentage}%
                                                            </span>
                                                            <div className={`w-full max-w-[220px] h-3 rounded-full overflow-hidden border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#E2E8F0] border-slate-300/60"}`}>
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-[#06B6D4] to-[#0284C7] transition-all duration-500 rounded-full"
                                                                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </motion.div>
                            </div>
                        ) : (
                            <div className="p-6 text-center text-xs font-semibold text-muted-foreground">
                                No additional bde with at least 1 IPD done.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    return <UnifiedLeaderboardView showTargetsAndActuals={false} enableAnimations={true} />;
}
