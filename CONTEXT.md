# Calorie Tracker App

## Purpose
A simple Next.js application to track daily calorie intake. Users can add food items with their calorie counts and see a running total for the day.

## Goals
- Allow users to input food items and calories.
- Display a list of consumed items.
- Show cumulative calories for the day.
- Provide a clean, responsive UI using Tailwind CSS v4.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **Package Manager**: Bun

## Architectural Decisions
- **State Management**: React `useState` for local state (persisted in memory for this version).
- **Components**: Modular components for the form, list, and summary.
- **Server/Client**: Use "use client" for the main tracker logic to handle user interactions.

## Major Changes
- Initial project setup and `CONTEXT.md` creation.
- Configured Tailwind CSS v4.
- Implemented `CalorieTracker` component with state management for adding/removing items.
- Created responsive UI with a summary card, input form, and activity log.
- Made food item name optional (defaults to "Unnamed Item").
- Added daily calorie goal setting.
- Implemented CSV export for calorie entries.
- Added a cumulative calorie chart with a goal line using Chart.js.
- Implemented a calorie target calculator based on body weight (sedentary).
- Added multiple target lines to the chart: Maintenance, 1 lb/week, and 2 lb/week.
