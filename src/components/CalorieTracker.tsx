"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CalorieItem {
  id: string;
  name: string;
  calories: number;
  timestamp: number;
}

interface Targets {
  maintenance: number;
  oneLb: number;
  twoLb: number;
}

function escapeCsvField(value: string): string {
  // RFC4180-ish escaping: wrap in quotes if needed, and escape quotes by doubling.
  const needsQuotes = /[\n\r",]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function parseCsv(text: string): string[][] {
  // Minimal CSV parser with support for quoted fields and commas/newlines inside quotes.
  // Returns rows of fields; empty trailing row is removed.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Avoid pushing a completely empty trailing row.
    if (row.length === 1 && row[0] === "" && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (ch === "\r") {
      // Handle CRLF
      const next = text[i + 1];
      if (next === "\n") i++;
      pushField();
      pushRow();
      continue;
    }

    field += ch;
  }

  // Flush final field/row.
  pushField();
  if (row.length > 1 || row[0] !== "") pushRow();

  return rows;
}

export default function CalorieTracker() {
  const [items, setItems] = useState<CalorieItem[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [weight, setWeight] = useState<string>("180");
  const [selectedTarget, setSelectedTarget] = useState<keyof Targets>("maintenance");
  const [showSettings, setShowSettings] = useState(false);
  const [showDailyChart, setShowDailyChart] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dataMenuRef = useRef<HTMLDivElement | null>(null);

  // Load persisted state from sessionStorage on mount
  useEffect(() => {
    try {
      const storedItems = sessionStorage.getItem('calorieTracker_items');
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        if (Array.isArray(parsedItems)) {
          setItems(parsedItems);
        }
      }
    } catch (error) {
      console.warn('Failed to load items from sessionStorage:', error);
    }

    try {
      const storedWeight = sessionStorage.getItem('calorieTracker_weight');
      if (storedWeight) {
        setWeight(storedWeight);
      }
    } catch (error) {
      console.warn('Failed to load weight from sessionStorage:', error);
    }

    try {
      const storedTarget = sessionStorage.getItem('calorieTracker_selectedTarget');
      if (storedTarget && ['maintenance', 'oneLb', 'twoLb'].includes(storedTarget)) {
        setSelectedTarget(storedTarget as keyof Targets);
      }
    } catch (error) {
      console.warn('Failed to load selectedTarget from sessionStorage:', error);
    }
  }, []);

  const targets = useMemo((): Targets => {
    const w = parseFloat(weight) || 0;
    // Sedentary maintenance: weight * 13-15 (using 14 as average)
    const maintenance = Math.round(w * 14);
    return {
      maintenance,
      oneLb: Math.max(1200, maintenance - 500),
      twoLb: Math.max(1200, maintenance - 1000),
    };
  }, [weight]);

  const currentGoal = targets[selectedTarget];

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calories) return;

    const newItem: CalorieItem = {
      id: crypto.randomUUID(),
      name: name || "Unnamed Item",
      calories: parseInt(calories),
      timestamp: Date.now(),
    };

    setItems((prev) => [...prev, newItem]);
    setName("");
    setCalories("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);

  const exportToCSV = () => {
    setImportStatus(null);
    const headers = ["Name", "Calories", "Time"];
    const rows = items.map((item) => [
      item.name,
      String(item.calories),
      // ISO 8601 is stable and importable across locales.
      new Date(item.timestamp).toISOString(),
    ]);

    const csvBody = toCsv([headers, ...rows]);
    const blob = new Blob([csvBody], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `calorie_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importFromCSV = async (file: File) => {
    setImportStatus(null);
    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      throw new Error("CSV must include a header row and at least one data row.");
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const caloriesIdx = header.indexOf("calories");
    const timeIdx = header.indexOf("time");

    if (nameIdx === -1 || caloriesIdx === -1 || timeIdx === -1) {
      throw new Error("CSV header must include: Name, Calories, Time");
    }

    const nextItems: CalorieItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Skip totally empty rows.
      if (row.every((cell) => cell.trim() === "")) continue;

      const rawName = (row[nameIdx] ?? "").trim();
      const rawCalories = (row[caloriesIdx] ?? "").trim();
      const rawTime = (row[timeIdx] ?? "").trim();

      const caloriesValue = Number.parseInt(rawCalories, 10);
      if (!Number.isFinite(caloriesValue)) {
        throw new Error(`Invalid Calories value on row ${i + 1}: ${rawCalories}`);
      }

      const parsedTime = new Date(rawTime).getTime();
      if (!Number.isFinite(parsedTime)) {
        throw new Error(`Invalid Time value on row ${i + 1}: ${rawTime}`);
      }

      nextItems.push({
        id: crypto.randomUUID(),
        name: rawName || "Unnamed Item",
        calories: caloriesValue,
        timestamp: parsedTime,
      });
    }

    // Keep chronological order in storage.
    nextItems.sort((a, b) => a.timestamp - b.timestamp);
    setItems(nextItems);
    setImportStatus(`Imported ${nextItems.length} item${nextItems.length === 1 ? "" : "s"} from CSV.`);
  };

  useEffect(() => {
    if (!isDataMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDataMenuOpen(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (dataMenuRef.current && !dataMenuRef.current.contains(target)) {
        setIsDataMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("pointerdown", onPointerDown);
        };
      }, [isDataMenuOpen]);
      // Save items to sessionStorage whenever items change
      useEffect(() => {
        try {
          sessionStorage.setItem('calorieTracker_items', JSON.stringify(items));
        } catch (error) {
          console.warn('Failed to save items to sessionStorage:', error);
        }
      }, [items]);
      // Save weight to sessionStorage whenever weight changes
      useEffect(() => {
        try {
          sessionStorage.setItem('calorieTracker_weight', weight);
        } catch (error) {
          console.warn('Failed to save weight to sessionStorage:', error);
        }
      }, [weight]);
      // Save selectedTarget to sessionStorage whenever selectedTarget changes
      useEffect(() => {
        try {
          sessionStorage.setItem('calorieTracker_selectedTarget', selectedTarget);
        } catch (error) {
          console.warn('Failed to save selectedTarget to sessionStorage:', error);
        }
      }, [selectedTarget]);
    
      const chartData = useMemo(() => {
    const sortedItems = [...items].sort((a, b) => a.timestamp - b.timestamp);
    let cumulative = 0;
    const dataPoints = sortedItems.map((item) => {
      cumulative += item.calories;
      return cumulative;
    });

    const labels = sortedItems.map((item) =>
      new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    labels.unshift("Start");
    dataPoints.unshift(0);

    const green = "rgb(34, 197, 94)";
    const yellow = "rgb(234, 179, 8)";

    return {
      labels,
      datasets: [
        {
          label: "Calories",
          data: dataPoints,
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.4,
          order: 1,
        },
        {
          label: "Maintenance",
          data: new Array(labels.length).fill(targets.maintenance),
          borderColor: selectedTarget === "maintenance" ? green : yellow,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 2,
        },
        {
          label: "1 lb per week",
          data: new Array(labels.length).fill(targets.oneLb),
          borderColor: selectedTarget === "oneLb" ? green : yellow,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 3,
        },
        {
          label: "2 lb per week",
          data: new Array(labels.length).fill(targets.twoLb),
          borderColor: selectedTarget === "twoLb" ? green : yellow,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 4,
        },
      ],
    };
  }, [items, targets, selectedTarget]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Calculate daily totals and statistics for the daily chart
  const dailyChartData = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    // Group items by day
    const dailyTotals = new Map<string, number>();
    items.forEach((item) => {
      const date = new Date(item.timestamp);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + item.calories);
    });

    // Sort by date
    const sortedDates = Array.from(dailyTotals.keys()).sort();
    const dailyCalories = sortedDates.map(date => dailyTotals.get(date) || 0);

    // Calculate rolling average (7-day)
    const rollingAverage: number[] = [];
    for (let i = 0; i < dailyCalories.length; i++) {
      const start = Math.max(0, i - 6);
      const window = dailyCalories.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      rollingAverage.push(Math.round(avg));
    }

    // Calculate overall average
    const totalCaloriesAllDays = dailyCalories.reduce((sum, val) => sum + val, 0);
    const averageCalories = Math.round(totalCaloriesAllDays / dailyCalories.length);

    // Calculate expected weight loss per month
    // Weight loss = (maintenance - average) * days / 3500 calories per pound
    const dailyDeficit = targets.maintenance - averageCalories;
    const expectedWeightLossPerMonth = (dailyDeficit * 30) / 3500;

    // Format dates for labels
    const labels = sortedDates.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    const green = "rgb(34, 197, 94)";
    const yellow = "rgb(234, 179, 8)";
    const red = "rgb(239, 68, 68)";

    return {
      chartData: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Daily Calories',
            data: dailyCalories,
            backgroundColor: 'rgba(37, 99, 235, 0.6)',
            borderColor: 'rgb(37, 99, 235)',
            borderWidth: 1,
            order: 2,
          },
          {
            type: 'line' as const,
            label: '7-Day Rolling Average',
            data: rollingAverage,
            borderColor: 'rgb(147, 51, 234)',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            order: 1,
          },
          {
            type: 'line' as const,
            label: 'Maintenance',
            data: new Array(labels.length).fill(targets.maintenance),
            borderColor: yellow,
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            order: 3,
          },
          {
            type: 'line' as const,
            label: '1 lb/week',
            data: new Array(labels.length).fill(targets.oneLb),
            borderColor: green,
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            order: 4,
          },
          {
            type: 'line' as const,
            label: '2 lb/week',
            data: new Array(labels.length).fill(targets.twoLb),
            borderColor: red,
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            order: 5,
          },
        ],
      },
      averageCalories,
      expectedWeightLossPerMonth,
    };
  }, [items, targets]);

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Calories',
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        }
      }
    },
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Calorie Tracker</h1>
          <p className="text-gray-500 mt-1">Keep track of your daily intake</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDailyChart(true)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Daily Statistics"
          >
            {/* Bar chart icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" x2="12" y1="20" y2="10" />
              <line x1="18" x2="18" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="16" />
            </svg>
          </button>
          <div className="relative" ref={dataMenuRef}>
            <button
              onClick={() => {
                setImportStatus(null);
                setIsDataMenuOpen((v) => !v);
              }}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-haspopup="menu"
              aria-expanded={isDataMenuOpen}
              title="Import/Export"
            >
              {/* Hamburger icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>

            {isDataMenuOpen && (
              <div
                role="menu"
                aria-label="Import/Export menu"
                className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-10"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    exportToCSV();
                    setIsDataMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Export to CSV
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    // Import replaces current items (with confirmation if needed)
                    if (items.length > 0) {
                      const ok = window.confirm(
                        "Importing will replace your current log. Continue?"
                      );
                      if (!ok) {
                        setIsDataMenuOpen(false);
                        return;
                      }
                    }
                    fileInputRef.current?.click();
                    setIsDataMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Import from CSV
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // Allow re-selecting the same file later.
                e.target.value = "";
                if (!file) return;
                try {
                  await importFromCSV(file);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to import CSV.";
                  setImportStatus(message);
                }
              }}
            />
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      {importStatus && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            importStatus.startsWith("Imported")
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {importStatus}
        </div>
      )}

      {showSettings && (
        <section className="bg-blue-50 p-6 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-200 space-y-6">
          <h2 className="text-lg font-semibold text-blue-900">Settings & Calculator</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-blue-800 mb-1">Current Weight (lbs)</label>
              <input
                type="number"
                id="weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-blue-600 mt-1">Calculations assume sedentary activity level.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">Select Active Goal</label>
              <div className="space-y-2">
                {(Object.keys(targets) as Array<keyof Targets>).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="target"
                      checked={selectedTarget === key}
                      onChange={() => setSelectedTarget(key)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-blue-900 group-hover:text-blue-700 capitalize">
                      {key.replace(/([A-Z])/, ' $1')}: <strong>{targets[key]} kcal</strong>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-center">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Calories</span>
            <div className="text-6xl font-black mt-2 text-blue-600">{totalCalories}</div>
            <div className="mt-4 text-sm text-gray-500">
              <span className="font-medium text-gray-700 capitalize">{selectedTarget.replace(/([A-Z])/, ' $1')} Goal: {currentGoal} kcal</span>
              <div className="mt-1">
                {totalCalories > currentGoal ? (
                  <span className="text-red-500 font-medium">Over goal by {totalCalories - currentGoal} kcal</span>
                ) : (
                  <span className="text-green-600 font-medium">{currentGoal - totalCalories} kcal remaining</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64">
          <Line data={chartData} options={chartOptions} />
        </section>
      </div>

      <form onSubmit={addItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="sm:col-span-1">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Food Item</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apple"
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="calories" className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
          <input
            type="number"
            id="calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            required
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-md active:scale-95"
          >
            Add Item
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold px-1 text-gray-900">Today{"'"}s Log</h2>
        {items.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
            No items added yet. Start by adding your first meal!
          </div>
        ) : (
          <div className="space-y-3">
            {[...items].reverse().map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 group animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg text-gray-900">{item.calories} <span className="text-xs font-normal text-gray-400">kcal</span></span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    aria-label="Remove item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Daily Chart Modal */}
      {showDailyChart && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDailyChart(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-900">Daily Calorie Statistics</h2>
              <button
                onClick={() => setShowDailyChart(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {dailyChartData ? (
                <>
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm font-medium text-blue-800 mb-1">Average Daily Calories</div>
                      <div className="text-3xl font-bold text-blue-900">{dailyChartData.averageCalories}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {dailyChartData.averageCalories > targets.maintenance
                          ? `${dailyChartData.averageCalories - targets.maintenance} above maintenance`
                          : `${targets.maintenance - dailyChartData.averageCalories} below maintenance`}
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm font-medium text-purple-800 mb-1">Expected Weight Loss</div>
                      <div className="text-3xl font-bold text-purple-900">
                        {dailyChartData.expectedWeightLossPerMonth > 0
                          ? `${dailyChartData.expectedWeightLossPerMonth.toFixed(1)} lbs`
                          : dailyChartData.expectedWeightLossPerMonth < 0
                          ? `+${Math.abs(dailyChartData.expectedWeightLossPerMonth).toFixed(1)} lbs`
                          : '0 lbs'}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        {dailyChartData.expectedWeightLossPerMonth > 0
                          ? 'per month (loss)'
                          : dailyChartData.expectedWeightLossPerMonth < 0
                          ? 'per month (gain)'
                          : 'per month (maintenance)'}
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ height: '500px' }}>
                    <Chart type="bar" data={dailyChartData.chartData} options={dailyChartOptions} />
                  </div>

                  {/* Legend Explanation */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                    <p className="font-medium text-gray-900 mb-2">Chart Guide:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong>Blue bars</strong> show your daily calorie intake</li>
                      <li><strong>Purple line</strong> shows your 7-day rolling average</li>
                      <li><strong>Dashed lines</strong> show your calorie goals (maintenance, 1 lb/week, 2 lb/week)</li>
                      <li>Weight loss calculation: 3,500 calorie deficit = 1 pound lost</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-4 opacity-50"
                  >
                    <line x1="12" x2="12" y1="20" y2="10" />
                    <line x1="18" x2="18" y1="20" y2="4" />
                    <line x1="6" x2="6" y1="20" y2="16" />
                  </svg>
                  <p className="text-lg">No data available yet</p>
                  <p className="text-sm mt-2">Start logging your meals to see daily statistics</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
