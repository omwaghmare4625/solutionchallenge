"use client";

import React, { useState } from "react";
import {
  CloudOff,
  MapPin,
  HeartPulse,
  HardHat,
  Apple,
  Home,
  Camera,
  X,
} from "lucide-react";

export default function SubmitReportPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [population, setPopulation] = useState("");
  const [description, setDescription] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [location, setLocation] = useState(null);

  const categories = [
    { id: "healthcare", label: "Healthcare", icon: HeartPulse },
    { id: "infrastructure", label: "Infrastructure", icon: HardHat },
    { id: "food", label: "Food", icon: Apple },
    { id: "shelter", label: "Shelter", icon: Home },
  ];

  const severityLevels = [
    { value: 1, color: "bg-green-500" },
    { value: 2, color: "bg-green-400" },
    { value: 3, color: "bg-yellow-500" },
    { value: 4, color: "bg-orange-500" },
    { value: 5, color: "bg-red-500" },
  ];

  const handleUseLocation = () => {
    // Mocking location fetch
    setLocation({ lat: 19.076, lng: 72.877 });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col max-w-md mx-auto relative pb-24">
      {/* 1. Top Navigation & Status Bar */}
      <header className="pt-12 pb-4 px-6 border-b border-white/10 sticky top-0 bg-slate-950/80 backdrop-blur-md z-20">
        <h1 className="text-xl font-bold tracking-tight">Submit Report</h1>
      </header>

      {/* Offline Banner */}
      <div className="bg-amber-500/20 px-6 py-3 flex items-center gap-3">
        <CloudOff className="text-amber-500 w-5 h-5" />
        <span className="text-amber-500 text-sm font-medium">
          Working Offline. Reports will sync automatically.
        </span>
      </div>

      {/* 2. Form Sections */}
      <main className="flex-1 flex flex-col gap-8 p-6">
        {/* Location Section */}
        <section className="flex flex-col gap-3">
          <button
            onClick={handleUseLocation}
            className="w-full h-12 bg-indigo-600 rounded-xl flex items-center justify-center gap-2 font-semibold text-white active:scale-[0.98] transition-transform"
          >
            <MapPin className="w-5 h-5" />
            Use Current GPS Location
          </button>
          {location && (
            <div className="text-slate-400 text-sm text-center">
              Lat: {location.lat}, Lng: {location.lng}
            </div>
          )}
        </section>

        {/* Category Section */}
        <section className="flex flex-col gap-3">
          <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
            Category
          </label>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  <Icon className="w-7 h-7" />
                  <span className="font-semibold text-sm">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Severity Scale */}
        <section className="flex flex-col gap-4">
          <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
            Urgency Level
          </label>
          <div className="flex flex-row justify-between items-center">
            {severityLevels.map((level) => {
              const isSelected = severity === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => setSeverity(level.value)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    level.color
                  } ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-offset-slate-950 ring-white scale-110"
                      : ""
                  }`}
                >
                  <span className="text-slate-950 font-bold text-lg">
                    {level.value}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Details Section */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
              Population Affected
            </label>
            <input
              type="number"
              value={population}
              onChange={(e) => setPopulation(e.target.value)}
              placeholder="e.g., 50"
              className="w-full h-14 bg-slate-900 border border-slate-800 rounded-xl px-4 text-white text-lg placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add specific details about the situation..."
              rows={4}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-none"
            />
          </div>
        </section>

        {/* Photo Capture */}
        <section className="flex flex-col gap-3">
          <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
            Photo
          </label>
          {hasPhoto ? (
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-indigo-600">
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                {/* Mock image thumbnail */}
                <Camera className="w-8 h-8 text-slate-500" />
              </div>
              <button
                onClick={() => setHasPhoto(false)}
                className="absolute top-2 right-2 bg-slate-950/60 backdrop-blur-sm p-1.5 rounded-full"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setHasPhoto(true)}
              className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-2 active:bg-slate-800 transition-colors"
            >
              <Camera className="w-8 h-8 text-slate-400" />
              <span className="text-slate-400 font-medium">
                Tap to open Camera or Gallery
              </span>
            </button>
          )}
        </section>
      </main>

      {/* 3. Action Area / Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-white/5 z-20">
        <div className="max-w-md mx-auto">
          <button className="w-full h-14 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-lg active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(22,163,74,0.3)]">
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}
