"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Moon
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";

interface ApiLeaderboardEntry {
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

interface ApiData {
  month: string;
  category: string;
  categories: string[];
  monthlyTopThree: {
    first: ApiLeaderboardEntry | null;
    second: ApiLeaderboardEntry | null;
    third: ApiLeaderboardEntry | null;
  };
  annualTopThree: ApiLeaderboardEntry[];
  rankings: ApiLeaderboardEntry[];
}

interface PodiumCardProps {
  title: string;
  icon: React.ReactNode;
  categoryLabel: string;
  podiumData: (ApiLeaderboardEntry | null)[];
  isDarkMode: boolean;
  valueFormatter: (bd: ApiLeaderboardEntry | null) => { primary: string; secondary: string };
  badgeColorClass: string;
}

const SteppedPodiumCard: React.FC<PodiumCardProps> = ({
  title,
  icon,
  categoryLabel,
  podiumData,
  isDarkMode,
  valueFormatter,
  badgeColorClass
}) => {
  return (
    <div
      className={`p-3.5 rounded-xl border shadow-md backdrop-blur-xl ${
        isDarkMode
          ? "bg-slate-900/60 border-slate-800/80"
          : "bg-white/95 border-slate-200/90 shadow-slate-200/60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {title}
          </h2>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColorClass}`}>
          {categoryLabel}
        </span>
      </div>

      {/* Stepped Podium Structure: [2nd (Left), 1st (Center/Tallest), 3rd (Right)] */}
      <div className="flex items-end justify-center gap-2 pt-2 pb-1 min-h-[120px]">
        {podiumData.map((bd, idx) => {
          const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
          const isGold = rank === 1;
          const isSilver = rank === 2;
          const isBronze = rank === 3;
          const { primary, secondary } = valueFormatter(bd);

          return (
            <div
              key={rank}
              className={`flex flex-col items-center justify-between w-1/3 p-2 rounded-lg border text-center transition-all ${
                isGold
                  ? isDarkMode
                    ? "h-[125px] bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border-amber-500/50 shadow-md shadow-amber-500/10 z-10"
                    : "h-[125px] bg-gradient-to-b from-amber-500/10 via-amber-50/50 to-white border-amber-400/80 shadow-md shadow-amber-400/15 z-10"
                  : isSilver
                  ? isDarkMode
                    ? "h-[105px] bg-gradient-to-b from-slate-400/15 via-slate-900 to-slate-950 border-slate-400/40"
                    : "h-[105px] bg-gradient-to-b from-slate-200/60 via-slate-50 to-white border-slate-300"
                  : isDarkMode
                  ? "h-[92px] bg-gradient-to-b from-amber-700/15 via-slate-900 to-slate-950 border-amber-700/40"
                  : "h-[92px] bg-gradient-to-b from-amber-100/40 via-amber-50/20 to-white border-amber-300/60"
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 mb-0.5">
                  {isGold && <Trophy className="w-3.5 h-3.5 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />}
                  {isSilver && <Medal className="w-3 h-3 text-slate-400" />}
                  {isBronze && <Award className="w-3 h-3 text-amber-600" />}
                  <span
                    className={`text-[10px] font-extrabold ${
                      isGold ? "text-amber-500" : isSilver ? (isDarkMode ? "text-slate-300" : "text-slate-700") : "text-amber-600"
                    }`}
                  >
                    {rank}
                  </span>
                </div>
                <h3
                  className={`text-[11px] font-bold line-clamp-1 max-w-[85px] ${
                    isDarkMode ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  {bd ? bd.name : "-"}
                </h3>
              </div>

              <div className={`w-full pt-1 border-t ${isDarkMode ? "border-slate-800/80" : "border-slate-200"}`}>
                <div className="text-xs font-black text-cyan-500">{primary}</div>
                <div className={`text-[9px] ${isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
                  {secondary}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function PublicBdeLeaderboardPage() {
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

  const fetchData = async () => {
    setLoading(true);
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
        setData(json.data);
      } else {
        throw new Error(json.error || "Invalid response format");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, selectedCategory]);

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

  // Derive Annual Top 3 in stepped order: [2nd (Left), 1st (Center), 3rd (Right)]
  const annualPodium = useMemo(() => {
    if (!data?.annualTopThree) return [null, null, null];
    return [
      data.annualTopThree[1] || null,
      data.annualTopThree[0] || null,
      data.annualTopThree[2] || null,
    ];
  }, [data?.annualTopThree]);

  // Definition of DataTable columns using TanStack Table API
  const columns = useMemo<ColumnDef<ApiLeaderboardEntry>[]>(() => {
    return [
      {
        accessorKey: "rank",
        header: "Rank",
        meta: {
          headerClassName: "text-center w-20",
          cellClassName: "text-center font-bold"
        },
        cell: ({ row }) => {
          const rank = row.original.rank;
          if (rank === 1) {
            return (
              <span className="inline-flex items-center justify-center gap-1 font-black text-amber-500">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span>1</span>
              </span>
            );
          }
          if (rank === 2) {
            return (
              <span className={`inline-flex items-center justify-center gap-1 font-black ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                <Medal className="w-4 h-4 text-slate-400 shrink-0" />
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
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-200 group-hover:border-cyan-500/50"
                    : "bg-slate-100 border-slate-300 text-slate-800 group-hover:border-cyan-600/50"
                }`}
              >
                {item.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div
                  className={`font-semibold transition-colors ${
                    isDarkMode
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
        cell: ({ row }) => (
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
              isDarkMode
                ? "bg-slate-800/80 text-slate-300 border-slate-700/60"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {row.original.category}
          </span>
        )
      },
      {
        accessorKey: "targetValue",
        header: "IPD Target",
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right font-medium"
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
          headerClassName: "text-right",
          cellClassName: "text-right font-bold"
        },
        cell: ({ row }) => (
          <span className={isDarkMode ? "text-white" : "text-slate-900"}>
            {row.original.actual}
          </span>
        )
      },
      {
        accessorKey: "percentage",
        header: "Target Achieved %",
        meta: {
          headerClassName: "min-w-[200px]"
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
                <span className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {item.actual} / {item.targetValue}
                </span>
              </div>
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden border ${
                  isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-200 border-slate-300"
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
      }
    ];
  }, [isDarkMode]);

  return (
    <div
      className={`min-h-screen font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden pb-16 transition-colors duration-300 ${
        isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Background Decorative Mesh / Ambient Lights */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl ${
            isDarkMode ? "bg-cyan-600/20" : "bg-cyan-500/15"
          }`}
        />
        <div
          className={`absolute top-1/3 -right-40 w-96 h-96 rounded-full blur-3xl ${
            isDarkMode ? "bg-emerald-600/15" : "bg-emerald-500/15"
          }`}
        />
        <div
          className={`absolute bottom-10 left-1/3 w-96 h-96 rounded-full blur-3xl ${
            isDarkMode ? "bg-blue-600/15" : "bg-blue-400/15"
          }`}
        />
        <div
          className={`absolute inset-0 bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:24px_24px] ${
            isDarkMode ? "opacity-30" : "opacity-15"
          }`}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Bar */}
        <header
          className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border shadow-xl backdrop-blur-xl ${
            isDarkMode
              ? "bg-slate-900/60 border-slate-800/80 shadow-cyan-950/20"
              : "bg-[#062D4C] border-[#062D4C] shadow-slate-400/30 text-white"
          }`}
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              BDE Leaderboard
            </h1>
          </div>

          {/* Controls: Month + Category + Theme Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Filter */}
            <div
              className={`relative flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-cyan-300 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500/50"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm focus-within:border-cyan-600 focus-within:ring-1 focus-within:ring-cyan-500/30"
              }`}
            >
              <Calendar className={`w-4 h-4 mr-2 shrink-0 ${isDarkMode ? "text-cyan-300" : "text-slate-700"}`} />
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) {
                    setMonth(e.target.value);
                  }
                }}
                className={`bg-transparent outline-none cursor-pointer text-xs font-bold w-full ${
                  isDarkMode ? "text-cyan-300 [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"
                }`}
              />
            </div>

            {/* Category Filter */}
            <div
              className={`relative flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all max-w-[200px] ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-emerald-300 focus-within:border-emerald-400"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm focus-within:border-emerald-600"
              }`}
            >
              <Filter className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`bg-transparent outline-none cursor-pointer pr-1 text-xs font-bold truncate w-full ${
                  isDarkMode ? "text-emerald-300" : "text-slate-900"
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

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`p-2 rounded-lg border transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700"
                  : "bg-white hover:bg-slate-100 text-amber-500 border-slate-300 shadow-sm"
              }`}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              title="Refresh Data"
              className={`p-2 rounded-lg border transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </header>

        {/* Top Stepped Podium Cards: Ultra Compact View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Monthly Champions Podium */}
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

          {/* Card 2: Annual Leaders Podium */}
          <SteppedPodiumCard
            title={`Annual Leaders (YTD ${month.split("-")[0]})`}
            icon={<Award className="w-4 h-4 text-emerald-500" />}
            categoryLabel="Year-To-Date"
            podiumData={annualPodium}
            isDarkMode={isDarkMode}
            badgeColorClass={
              isDarkMode
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                : "bg-emerald-100/80 text-emerald-800 border-emerald-200"
            }
            valueFormatter={(bd) => ({
              primary: bd ? `${bd.annualActual} IPD` : "-",
              secondary: bd ? "Cumulative YTD" : "-"
            })}
          />
        </div>

        {/* Main Rankings Table Container using Generic DataTable */}
        <div
          className={`rounded-2xl border shadow-xl overflow-hidden backdrop-blur-xl ${
            isDarkMode
              ? "bg-slate-900/60 border-slate-800/80 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-slate-300/40"
          }`}
        >
          {/* Table Header Controls */}
          <div
            className={`p-4 border-b flex flex-col md:flex-row items-center justify-between gap-4 ${
              isDarkMode ? "border-slate-800/80" : "border-slate-200"
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
                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              />
              <input
                type="text"
                placeholder="Search BDE or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-xl border pl-9 pr-4 py-1.5 text-xs transition-all outline-none ${
                  isDarkMode
                    ? "bg-slate-950/80 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-cyan-500"
                    : "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600"
                }`}
              />
            </div>
          </div>

          {/* TanStack DataTable with Pagination Footer */}
          <div className="p-2">
            <DataTable
              columns={columns}
              data={filteredLeaderboard}
              isLoading={loading}
              emptyMessage="No business development executives found matching your criteria."
              enablePagination={true}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              tableHeaderClassName={
                isDarkMode
                  ? "bg-slate-950/70 border-slate-800/80 text-slate-400"
                  : "bg-slate-100/80 border-slate-200 text-slate-600"
              }
              tableContainerClassName="border-0 shadow-none bg-transparent"
              rowClassName={() =>
                isDarkMode ? "hover:bg-slate-800/40 border-slate-800/60" : "hover:bg-slate-100/60 border-slate-200"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
