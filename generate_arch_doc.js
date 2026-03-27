const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
        ExternalHyperlink, TableOfContents } = require('docx');
const fs = require('fs');

const SZ = 22; // 11pt
const SZ_SM = 18; // 9pt
const FONT = "Arial";
const BLUE = "2E5090";
const GRAY = "666666";
const LIGHT_BLUE = "D5E8F0";
const LIGHT_GRAY = "F5F5F5";

function txt(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SZ, ...opts });
}
function bold(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SZ, bold: true, ...opts });
}
function para(runs, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, ...opts, children: Array.isArray(runs) ? runs : [runs] });
}
function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 28 : 24 })]
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const margins = { top: 60, bottom: 60, left: 100, right: 100 };

function hCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: "2E5090", type: ShadingType.CLEAR },
    margins, verticalAlign: VerticalAlign.CENTER,
    children: [para([bold(text, { color: "FFFFFF" })], { alignment: AlignmentType.CENTER })]
  });
}
function cell(runs, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins, verticalAlign: VerticalAlign.TOP, ...opts,
    children: Array.isArray(runs) ? runs : [para(runs)]
  });
}

const children = [];

// ===== TITLE PAGE =====
children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "VoxTranslate", font: FONT, size: 72, bold: true, color: BLUE })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Agentic AI Translation Workflow", font: FONT, size: 36, color: GRAY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "System Architecture & Deployment Guide", font: FONT, size: 28, color: GRAY })]
}));
children.push(new Paragraph({ spacing: { before: 800 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
  spacing: { before: 200, after: 200 },
  children: []
}));

const metaRows = [
  ["Version", "1.0"],
  ["Date", "March 20, 2026"],
  ["Author", "Lofte Studios"],
  ["Hardware Target", "Mac Studio / Mac Pro (Apple Silicon)"],
  ["Volume", "10-30 videos/day"],
  ["Users", "Internal Team"],
];
for (const [k, v] of metaRows) {
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [bold(`${k}: `), txt(v)]
  }));
}

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== TOC =====
children.push(heading("Table of Contents", HeadingLevel.HEADING_1));
children.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 1. EXECUTIVE SUMMARY =====
children.push(heading("1. Executive Summary", HeadingLevel.HEADING_1));
children.push(para([txt("VoxTranslate is a full-stack agentic AI workflow that automates video translation for YouTube Trust & Safety compliance. The system processes YouTube videos through a multi-stage pipeline: download, transcription (ElevenLabs Scribe v2), on-screen text detection (Claude Vision), AI translation with T&S compliance (Claude API), and formatted DOCX export.")]));
children.push(para([txt("This document details the architecture for a self-hosted webapp deployment on a dedicated Mac Studio, designed to handle 10-30 videos per day with fast parallel processing and a modern web interface for the internal Lofte Studios team.")]));

// ===== 2. SYSTEM ARCHITECTURE =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("2. System Architecture Overview", HeadingLevel.HEADING_1));
children.push(para([txt("The system follows a microservices-inspired architecture deployed via Docker Compose on a single Mac Studio. Components communicate through Redis for job queuing and PostgreSQL for persistent state.")]));

children.push(heading("2.1 High-Level Architecture", HeadingLevel.HEADING_2));
children.push(para([txt("The architecture consists of five main components:")]));
children.push(para([bold("1. Next.js Frontend"), txt(" - React-based web interface with real-time job status updates via Server-Sent Events (SSE). Handles job submission, progress monitoring, file downloads, and team dashboard.")]));
children.push(para([bold("2. FastAPI Backend"), txt(" - Python async API server handling authentication, job management, file serving, and WebSocket connections. Orchestrates the pipeline and exposes RESTful endpoints.")]));
children.push(para([bold("3. Celery Workers"), txt(" - Distributed task workers executing pipeline stages in parallel. Each worker can process one video at a time, with 4-6 workers running concurrently on the Mac Studio.")]));
children.push(para([bold("4. Redis"), txt(" - Message broker for Celery task queue, real-time pub/sub for job status updates, and caching layer for API responses and rate limiting.")]));
children.push(para([bold("5. PostgreSQL"), txt(" - Persistent storage for job records, translation history, user accounts, and audit logs.")]));

children.push(heading("2.2 Data Flow", HeadingLevel.HEADING_2));
children.push(para([txt("User submits YouTube URL via webapp -> FastAPI creates job record in PostgreSQL -> Job dispatched to Redis queue -> Celery worker picks up job -> Pipeline stages execute sequentially -> Each stage updates job status in real-time via Redis pub/sub -> Frontend receives SSE updates -> Completed DOCX available for download.")]));

// ===== 3. TECH STACK =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("3. Technology Stack", HeadingLevel.HEADING_1));

const stackRows = [
  ["Layer", "Technology", "Version", "Rationale"],
  ["Frontend", "Next.js 14 (App Router)", "14.x", "Server components, streaming, built-in API routes"],
  ["UI Framework", "Tailwind CSS + shadcn/ui", "3.x", "Rapid UI development, consistent design system"],
  ["Backend API", "FastAPI (Python)", "0.110+", "Async-native, auto-docs, type safety with Pydantic"],
  ["Task Queue", "Celery", "5.4+", "Battle-tested distributed task execution"],
  ["Message Broker", "Redis", "7.x", "Fast pub/sub, caching, rate limiting"],
  ["Database", "PostgreSQL", "16", "JSONB for flexible schema, full-text search"],
  ["ORM", "SQLAlchemy + Alembic", "2.0+", "Async ORM, schema migrations"],
  ["Transcription", "ElevenLabs Scribe v2", "API", "Video-native, 99 languages, speaker diarization"],
  ["Translation", "Claude API (Sonnet)", "claude-sonnet-4-20250514", "T&S compliance, cultural annotations"],
  ["OST Detection", "Claude Vision", "claude-sonnet-4-20250514", "Frame analysis for on-screen text"],
  ["Video Download", "yt-dlp", "Latest", "Reliable YouTube extraction"],
  ["Frame Extraction", "ffmpeg", "6.x", "GPU-accelerated on Apple Silicon"],
  ["DOCX Generation", "python-docx", "1.1+", "Native Python, no Node dependency"],
  ["Containerization", "Docker + Compose", "Latest", "Reproducible deployment"],
  ["Reverse Proxy", "Caddy", "2.x", "Auto HTTPS, simple config"],
];

const colW = [1400, 2400, 1000, 4560];
const stackTableRows = [];
stackTableRows.push(new TableRow({ children: stackRows[0].map((h, i) => hCell(h, colW[i])) }));
for (let r = 1; r < stackRows.length; r++) {
  stackTableRows.push(new TableRow({
    children: stackRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], colW[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: colW,
  rows: stackTableRows
}));

// ===== 4. PIPELINE ARCHITECTURE =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("4. Pipeline Architecture", HeadingLevel.HEADING_1));
children.push(para([txt("Each video job executes through 5 sequential stages. The pipeline is designed for maximum throughput: while one video is being transcribed, another can be downloading, and a third can be translating.")]));

children.push(heading("4.1 Stage 1: Video Download", HeadingLevel.HEADING_2));
children.push(para([bold("Tool: "), txt("yt-dlp")]));
children.push(para([bold("Input: "), txt("YouTube URL")]));
children.push(para([bold("Output: "), txt("video.mp4 + metadata.json")]));
children.push(para([bold("Duration: "), txt("30-120 seconds (depends on video length and resolution)")]));
children.push(para([txt("Downloads video at optimal resolution (360p for translation, 720p if OST detection needs higher fidelity). Extracts metadata including title, description, duration, thumbnail URL, upload date, and channel info. Validates video accessibility and handles geo-restrictions with proxy support.")]));

children.push(heading("4.2 Stage 2: Transcription", HeadingLevel.HEADING_2));
children.push(para([bold("Tool: "), txt("ElevenLabs Scribe v2 API")]));
children.push(para([bold("Input: "), txt("video.mp4 (direct upload, no audio extraction needed)")]));
children.push(para([bold("Output: "), txt("transcription.json (word-level timestamps, speaker diarization)")]));
children.push(para([bold("Duration: "), txt("60-180 seconds for a 10-min video")]));
children.push(para([bold("Cost: "), txt("~$0.018/minute of audio")]));
children.push(para([txt("Scribe v2 accepts video files directly, eliminating the ffmpeg audio extraction step. Returns word-level timestamps with speaker diarization (up to 32 speakers). The output is segmented into 1-minute blocks for translation.")]));

children.push(heading("4.3 Stage 3: OST Detection", HeadingLevel.HEADING_2));
children.push(para([bold("Tool: "), txt("ffmpeg + Claude Vision API")]));
children.push(para([bold("Input: "), txt("video.mp4")]));
children.push(para([bold("Output: "), txt("ost.json (detected on-screen text with 8-type classification)")]));
children.push(para([bold("Duration: "), txt("60-300 seconds (depends on frame count)")]));
children.push(para([bold("Cost: "), txt("~$0.02 per frame batch")]));
children.push(para([txt("Extracts frames at 3-second intervals using ffmpeg (GPU-accelerated on Apple Silicon via VideoToolbox). Frames are batched (10 per API call) and sent to Claude Vision for text detection and classification into 8 types: subtitle, banner, static, rolling, live_chat, watermark, bisect, lyrics. Parallel batch processing reduces wall time significantly.")]));

children.push(heading("4.4 Stage 4: Translation", HeadingLevel.HEADING_2));
children.push(para([bold("Tool: "), txt("Claude API (claude-sonnet-4-20250514)")]));
children.push(para([bold("Input: "), txt("transcription.json + ost.json")]));
children.push(para([bold("Output: "), txt("translation.json (T&S compliant translation)")]));
children.push(para([bold("Duration: "), txt("30-90 seconds")]));
children.push(para([bold("Cost: "), txt("~$0.08 per 10-min video")]));
children.push(para([txt("Sends the full transcript in a single API call with the optimized T&S translation prompt. The prompt resolves speaker names from context, generates detailed contextual notes (not shallow labels), flags incitement to violence in notes (not inline tags), preserves filler words and hesitations, and treats crowd responses as separate speakers. Output includes hate speech flagging with severity/context, cultural annotations, and [inaudible] markers.")]));

children.push(heading("4.5 Stage 5: DOCX Export", HeadingLevel.HEADING_2));
children.push(para([bold("Tool: "), txt("python-docx")]));
children.push(para([bold("Input: "), txt("translation.json")]));
children.push(para([bold("Output: "), txt("VoxTranslate_[title]_[date].docx")]));
children.push(para([bold("Duration: "), txt("2-5 seconds")]));
children.push(para([txt("Assembles the translation into Lofte Studios' standard 4-column delivery format (Timestamp | Translation | OST | Notes) with header section containing video metadata, linguistic profile, instructions, and video summary. Uses Calibri 9pt, blue-gray header shading, landscape orientation.")]));

// ===== 5. PARALLEL PROCESSING =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("5. Parallel Processing Strategy", HeadingLevel.HEADING_1));
children.push(para([txt("The Mac Studio's multi-core Apple Silicon enables aggressive parallelism. The system runs 4-6 Celery workers simultaneously, each handling one video pipeline. This means 4-6 videos process concurrently.")]));

children.push(heading("5.1 Throughput Estimates", HeadingLevel.HEADING_2));

const tpRows = [
  ["Metric", "Conservative", "Optimistic"],
  ["Avg pipeline time (10-min video)", "5 minutes", "3 minutes"],
  ["Concurrent workers", "4", "6"],
  ["Videos/hour", "48", "120"],
  ["Videos/8hr day", "384", "960"],
  ["Target (10-30/day)", "Easily met", "Easily met"],
];
const tpCols = [3500, 2930, 2930];
const tpTableRows = [];
tpTableRows.push(new TableRow({ children: tpRows[0].map((h, i) => hCell(h, tpCols[i])) }));
for (let r = 1; r < tpRows.length; r++) {
  tpTableRows.push(new TableRow({
    children: tpRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], tpCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: tpCols, rows: tpTableRows }));

children.push(para([txt("")]));
children.push(para([txt("The bottleneck is API rate limits, not local compute. ElevenLabs allows concurrent requests, and Claude API supports high throughput on paid plans. The system includes exponential backoff and retry logic for rate limit handling.")]));

children.push(heading("5.2 Intra-Pipeline Parallelism", HeadingLevel.HEADING_2));
children.push(para([txt("Within a single video pipeline, the OST detection stage parallelizes frame batch processing. For a 10-minute video with ~200 frames, batches of 10 frames are sent to Claude Vision concurrently (up to 5 parallel API calls), reducing OST detection from ~5 minutes to ~1 minute.")]));

// ===== 6. API DESIGN =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("6. API Design", HeadingLevel.HEADING_1));

children.push(heading("6.1 REST Endpoints", HeadingLevel.HEADING_2));

const apiRows = [
  ["Method", "Endpoint", "Description"],
  ["POST", "/api/jobs", "Submit new video job (YouTube URL or file upload)"],
  ["GET", "/api/jobs", "List all jobs with filtering and pagination"],
  ["GET", "/api/jobs/{id}", "Get job details including stage progress"],
  ["GET", "/api/jobs/{id}/download", "Download completed DOCX file"],
  ["DELETE", "/api/jobs/{id}", "Cancel a running job or delete completed"],
  ["POST", "/api/jobs/{id}/retry", "Retry a failed job from the failed stage"],
  ["GET", "/api/jobs/{id}/events", "SSE stream for real-time job updates"],
  ["GET", "/api/stats", "Dashboard statistics (daily/weekly counts)"],
  ["POST", "/api/batch", "Submit multiple URLs for batch processing"],
  ["GET", "/api/health", "System health check (workers, Redis, DB)"],
];
const apiCols = [1000, 3000, 5360];
const apiTableRows = [];
apiTableRows.push(new TableRow({ children: apiRows[0].map((h, i) => hCell(h, apiCols[i])) }));
for (let r = 1; r < apiRows.length; r++) {
  apiTableRows.push(new TableRow({
    children: apiRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], apiCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: apiCols, rows: apiTableRows }));

children.push(heading("6.2 Job Status Model", HeadingLevel.HEADING_2));
children.push(para([txt("Each job tracks its current stage and overall progress:")]));

const statusRows = [
  ["Status", "Description"],
  ["queued", "Job submitted, waiting for available worker"],
  ["downloading", "yt-dlp downloading video and metadata"],
  ["transcribing", "ElevenLabs Scribe v2 processing audio"],
  ["detecting_ost", "Claude Vision analyzing video frames for text"],
  ["translating", "Claude API translating with T&S compliance"],
  ["exporting", "Generating formatted DOCX document"],
  ["completed", "Pipeline finished, DOCX ready for download"],
  ["failed", "Error occurred (includes stage and error message)"],
  ["cancelled", "User cancelled the job"],
];
const statusCols = [2500, 6860];
const statusTableRows = [];
statusTableRows.push(new TableRow({ children: statusRows[0].map((h, i) => hCell(h, statusCols[i])) }));
for (let r = 1; r < statusRows.length; r++) {
  statusTableRows.push(new TableRow({
    children: statusRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], statusCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: statusCols, rows: statusTableRows }));

// ===== 7. DATABASE SCHEMA =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("7. Database Schema", HeadingLevel.HEADING_1));

children.push(heading("7.1 Jobs Table", HeadingLevel.HEADING_2));
const dbRows = [
  ["Column", "Type", "Description"],
  ["id", "UUID (PK)", "Unique job identifier"],
  ["youtube_url", "VARCHAR(500)", "Source YouTube URL"],
  ["video_title", "VARCHAR(500)", "Extracted video title"],
  ["source_language", "VARCHAR(50)", "Detected source language"],
  ["duration_seconds", "INTEGER", "Video duration"],
  ["status", "ENUM", "Current pipeline status"],
  ["current_stage", "VARCHAR(50)", "Active pipeline stage"],
  ["progress_pct", "INTEGER", "Overall progress (0-100)"],
  ["submitted_by", "VARCHAR(100)", "Team member who submitted"],
  ["submitted_at", "TIMESTAMP", "Job submission time"],
  ["completed_at", "TIMESTAMP", "Job completion time"],
  ["output_path", "VARCHAR(500)", "Path to generated DOCX"],
  ["error_message", "TEXT", "Error details if failed"],
  ["metadata", "JSONB", "Video metadata from yt-dlp"],
  ["transcription", "JSONB", "Raw transcription data"],
  ["translation", "JSONB", "Translation results with T&S flags"],
  ["cost_usd", "DECIMAL(8,4)", "Total API cost for this job"],
];
const dbCols = [2200, 2200, 4960];
const dbTableRows = [];
dbTableRows.push(new TableRow({ children: dbRows[0].map((h, i) => hCell(h, dbCols[i])) }));
for (let r = 1; r < dbRows.length; r++) {
  dbTableRows.push(new TableRow({
    children: dbRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], dbCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: dbCols, rows: dbTableRows }));

// ===== 8. FRONTEND DESIGN =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("8. Frontend Design", HeadingLevel.HEADING_1));
children.push(para([txt("The webapp provides a clean, functional interface for the internal team. Built with Next.js 14 App Router and Tailwind CSS + shadcn/ui components.")]));

children.push(heading("8.1 Pages", HeadingLevel.HEADING_2));
children.push(para([bold("Dashboard (/) "), txt("- Overview of today's jobs, active processing count, weekly stats, and quick-submit form. Shows a live feed of job status updates.")]));
children.push(para([bold("Submit Job (/submit) "), txt("- Form to paste YouTube URL(s), select processing options (language hint, priority, OST detection toggle), and submit. Supports batch submission of multiple URLs.")]));
children.push(para([bold("Job Queue (/jobs) "), txt("- Paginated list of all jobs with filtering by status, date, and language. Each row shows thumbnail, title, status badge, progress bar, and action buttons.")]));
children.push(para([bold("Job Detail (/jobs/[id]) "), txt("- Real-time pipeline progress with stage-by-stage status. Shows video metadata, transcription preview, translation preview, T&S flag summary, and download button for completed DOCX.")]));
children.push(para([bold("Settings (/settings) "), txt("- API key management, default processing options, notification preferences, and system health monitoring.")]));

children.push(heading("8.2 Real-Time Updates", HeadingLevel.HEADING_2));
children.push(para([txt("Server-Sent Events (SSE) provide real-time job status updates without polling. The FastAPI backend publishes events to Redis pub/sub, and the SSE endpoint streams them to connected clients. This enables live progress bars, stage transitions, and completion notifications.")]));

// ===== 9. DEPLOYMENT =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("9. Deployment & Infrastructure", HeadingLevel.HEADING_1));

children.push(heading("9.1 Mac Studio Hardware Requirements", HeadingLevel.HEADING_2));
const hwRows = [
  ["Component", "Minimum", "Recommended"],
  ["Chip", "M2 Pro", "M2 Ultra / M4 Max"],
  ["RAM", "32 GB", "64 GB+"],
  ["Storage", "512 GB SSD", "1 TB+ SSD"],
  ["Network", "100 Mbps", "1 Gbps (for fast video downloads)"],
];
const hwCols = [2500, 3430, 3430];
const hwTableRows = [];
hwTableRows.push(new TableRow({ children: hwRows[0].map((h, i) => hCell(h, hwCols[i])) }));
for (let r = 1; r < hwRows.length; r++) {
  hwTableRows.push(new TableRow({
    children: hwRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], hwCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: hwCols, rows: hwTableRows }));

children.push(heading("9.2 Docker Compose Services", HeadingLevel.HEADING_2));
const dockerRows = [
  ["Service", "Image", "Ports", "Resources"],
  ["frontend", "node:20-alpine", "3000", "512MB RAM"],
  ["backend", "python:3.12-slim", "8000", "1GB RAM"],
  ["worker", "python:3.12-slim (x4-6)", "-", "2GB RAM each"],
  ["redis", "redis:7-alpine", "6379", "256MB RAM"],
  ["postgres", "postgres:16-alpine", "5432", "512MB RAM"],
  ["caddy", "caddy:2-alpine", "80, 443", "128MB RAM"],
];
const dkCols = [1500, 2800, 1200, 3860];
const dkTableRows = [];
dkTableRows.push(new TableRow({ children: dockerRows[0].map((h, i) => hCell(h, dkCols[i])) }));
for (let r = 1; r < dockerRows.length; r++) {
  dkTableRows.push(new TableRow({
    children: dockerRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], dkCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: dkCols, rows: dkTableRows }));

children.push(para([txt("")]));
children.push(para([txt("Total RAM: ~14-16 GB with 4-6 workers, well within Mac Studio capabilities. The remaining RAM is available for system use and video processing buffers.")]));

children.push(heading("9.3 Setup Commands", HeadingLevel.HEADING_2));
children.push(para([txt("The entire system deploys with three commands:")]));
children.push(para([bold("1. "), txt("git clone https://github.com/lofte-studios/voxtranslate.git")]));
children.push(para([bold("2. "), txt("cp .env.example .env  (add API keys)")]));
children.push(para([bold("3. "), txt("docker compose up -d")]));
children.push(para([txt("The system auto-initializes the database, runs migrations, and starts all services. Caddy provides automatic HTTPS for local network access.")]));

// ===== 10. COST ANALYSIS =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("10. Cost Analysis", HeadingLevel.HEADING_1));

const costRows = [
  ["Stage", "Cost/10-min Video", "Cost/30 Videos/Day", "Monthly (22 days)"],
  ["ElevenLabs Scribe v2", "$0.18", "$5.40", "$118.80"],
  ["Claude Vision (OST)", "$0.20", "$6.00", "$132.00"],
  ["Claude API (Translation)", "$0.08", "$2.40", "$52.80"],
  ["Infrastructure (Mac Studio)", "-", "-", "$0 (owned hardware)"],
  ["Total", "$0.46", "$13.80", "$303.60"],
];
const costCols = [2500, 2000, 2430, 2430];
const costTableRows = [];
costTableRows.push(new TableRow({ children: costRows[0].map((h, i) => hCell(h, costCols[i])) }));
for (let r = 1; r < costRows.length; r++) {
  const isTotalRow = r === costRows.length - 1;
  costTableRows.push(new TableRow({
    children: costRows[r].map((c, i) => cell(
      [isTotalRow ? bold(c, { size: SZ_SM }) : txt(c, { size: SZ_SM })], costCols[i],
      isTotalRow ? { shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR } } :
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: costCols, rows: costTableRows }));

children.push(para([txt("")]));
children.push(para([txt("At 30 videos/day, the system costs approximately $303.60/month in API fees. This is significantly cheaper than manual translation services and cloud-hosted AI platforms, with the added benefit of data staying on premises.")]));

// ===== 11. SECURITY =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("11. Security & Access Control", HeadingLevel.HEADING_1));
children.push(para([txt("Since this is an internal-only deployment, the security model is simplified but still robust:")]));
children.push(para([bold("Authentication: "), txt("Simple team login with bcrypt-hashed passwords stored in PostgreSQL. Session-based auth with HTTP-only cookies. No external OAuth needed for internal use.")]));
children.push(para([bold("API Keys: "), txt("Stored as encrypted environment variables in Docker secrets, never committed to source control. Rotated quarterly.")]));
children.push(para([bold("Network: "), txt("Caddy reverse proxy with optional Tailscale VPN for remote access. All traffic encrypted via HTTPS.")]));
children.push(para([bold("Data: "), txt("All video files, transcriptions, and translations stored locally on the Mac Studio. No data leaves the premises except API calls to ElevenLabs and Anthropic.")]));

// ===== 12. MONITORING =====
children.push(heading("12. Monitoring & Observability", HeadingLevel.HEADING_1));
children.push(para([bold("Health Dashboard: "), txt("Built into the webapp settings page. Shows worker count, queue depth, Redis memory, PostgreSQL connections, disk usage, and API quota remaining.")]));
children.push(para([bold("Alerts: "), txt("Slack webhook notifications for job failures, worker crashes, API key expiry warnings, and disk space warnings. Configurable thresholds.")]));
children.push(para([bold("Logging: "), txt("Structured JSON logging across all services, aggregated via Docker log driver. Logs include job ID, stage, duration, API costs, and error traces.")]));

// ===== 13. DEVELOPMENT ROADMAP =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("13. Development Roadmap", HeadingLevel.HEADING_1));

const roadmapRows = [
  ["Phase", "Timeline", "Deliverables"],
  ["Phase 1: Core Pipeline", "Week 1-2", "FastAPI backend, Celery workers, full pipeline (download, transcribe, OST, translate, export), job tracking, PostgreSQL schema"],
  ["Phase 2: Frontend", "Week 3", "Next.js webapp, dashboard, job submission, real-time status, DOCX download, basic auth"],
  ["Phase 3: Docker & Deploy", "Week 4", "Docker Compose, Caddy config, environment setup, deployment scripts, Mac Studio setup guide"],
  ["Phase 4: Polish & QA", "Week 5", "Error handling, retry logic, batch processing, Slack notifications, monitoring dashboard, team testing"],
];
const rmCols = [2000, 1500, 5860];
const rmTableRows = [];
rmTableRows.push(new TableRow({ children: roadmapRows[0].map((h, i) => hCell(h, rmCols[i])) }));
for (let r = 1; r < roadmapRows.length; r++) {
  rmTableRows.push(new TableRow({
    children: roadmapRows[r].map((c, i) => cell([txt(c, { size: SZ_SM })], rmCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: rmCols, rows: rmTableRows }));

// ===== 14. PROJECT STRUCTURE =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("14. Project Structure", HeadingLevel.HEADING_1));
children.push(para([txt("voxtranslate/")]));
children.push(para([txt("  docker-compose.yml")]));
children.push(para([txt("  .env.example")]));
children.push(para([txt("  Caddyfile")]));
children.push(para([txt("  backend/")]));
children.push(para([txt("    Dockerfile")]));
children.push(para([txt("    requirements.txt")]));
children.push(para([txt("    app/")]));
children.push(para([txt("      main.py                  (FastAPI app)")]));
children.push(para([txt("      config.py                (Settings via pydantic-settings)")]));
children.push(para([txt("      models.py                (SQLAlchemy models)")]));
children.push(para([txt("      schemas.py               (Pydantic request/response)")]));
children.push(para([txt("      routes/")]));
children.push(para([txt("        jobs.py                (Job CRUD + SSE)")]));
children.push(para([txt("        batch.py               (Batch submission)")]));
children.push(para([txt("        stats.py               (Dashboard stats)")]));
children.push(para([txt("        health.py              (Health checks)")]));
children.push(para([txt("      pipeline/")]));
children.push(para([txt("        tasks.py               (Celery task definitions)")]));
children.push(para([txt("        download.py            (yt-dlp wrapper)")]));
children.push(para([txt("        transcribe.py          (ElevenLabs Scribe v2)")]));
children.push(para([txt("        detect_ost.py          (ffmpeg + Claude Vision)")]));
children.push(para([txt("        translate.py           (Claude API translation)")]));
children.push(para([txt("        export_docx.py         (python-docx generation)")]));
children.push(para([txt("      db/")]));
children.push(para([txt("        database.py            (Async engine + session)")]));
children.push(para([txt("        migrations/            (Alembic)")]));
children.push(para([txt("  frontend/")]));
children.push(para([txt("    Dockerfile")]));
children.push(para([txt("    package.json")]));
children.push(para([txt("    app/")]));
children.push(para([txt("      layout.tsx               (Root layout + providers)")]));
children.push(para([txt("      page.tsx                 (Dashboard)")]));
children.push(para([txt("      submit/page.tsx          (Job submission form)")]));
children.push(para([txt("      jobs/page.tsx            (Job list)")]));
children.push(para([txt("      jobs/[id]/page.tsx       (Job detail + live status)")]));
children.push(para([txt("      settings/page.tsx        (Settings + health)")]));
children.push(para([txt("    components/")]));
children.push(para([txt("      JobCard.tsx")]));
children.push(para([txt("      PipelineProgress.tsx")]));
children.push(para([txt("      StatsWidget.tsx")]));
children.push(para([txt("      SubmitForm.tsx")]));

// ===== FOOTER =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
  spacing: { before: 200, after: 200 },
  children: []
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "VoxTranslate System Architecture v1.0 - Lofte Studios", font: FONT, size: SZ_SM, color: GRAY, italics: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Confidential - Internal Use Only", font: FONT, size: SZ_SM, color: GRAY, italics: true })]
}));

// ===== BUILD =====
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: SZ } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: BLUE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT },
        paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "VoxTranslate Architecture v1.0", font: FONT, size: 16, color: GRAY, italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Page ", font: FONT, size: 16, color: GRAY }),
                     new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GRAY })]
        })]
      })
    },
    children
  }]
});

const outputPath = "/sessions/awesome-amazing-feynman/mnt/outputs/VoxTranslate_Architecture_v1.0.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Architecture doc generated:", outputPath);
  console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
});
