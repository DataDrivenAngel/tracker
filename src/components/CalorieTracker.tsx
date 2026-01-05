"use client";

import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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

export default function CalorieTracker() {
  const [items, setItems] = useState<CalorieItem[]>([]);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [weight, setWeight] = useState<string>("180");
  const [selectedTarget, setSelectedTarget] = useState<keyof Targets>("maintenance");
  const [showSettings, setShowSettings] = useState(false);

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
    const headers = ["Name", "Calories", "Time"];
    const rows = items.map((item) => [
      item.name,
      item.calories,
      new Date(item.timestamp).toLocaleString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `calorie_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          borderColor: "rgb(34, 197, 94)",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 2,
        },
        {
          label: "1 lb per week",
          data: new Array(labels.length).fill(targets.oneLb),
          borderColor: "rgb(234, 179, 8)",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 3,
        },
        {
          label: "2 lb per week",
          data: new Array(labels.length).fill(targets.twoLb),
          borderColor: "rgb(239, 68, 68)",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 4,
        },
      ],
    };
  }, [items, targets]);

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

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Calorie Tracker</h1>
          <p className="text-gray-500 mt-1">Keep track of your daily intake</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Export to CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

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
    </div>
  );
}
