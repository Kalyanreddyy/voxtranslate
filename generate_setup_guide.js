const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const SZ = 22; // 11pt
const SZ_SM = 20; // 10pt
const SZ_CODE = 20; // 10pt
const FONT = "Arial";
const MONO = "Menlo";
const BLUE = "2E5090";
const GRAY = "666666";
const LIGHT_GRAY = "F5F5F5";
const CODE_BG = "F0F2F5";

function txt(text, opts = {}) { return new TextRun({ text, font: FONT, size: SZ, ...opts }); }
function bold(text, opts = {}) { return new TextRun({ text, font: FONT, size: SZ, bold: true, ...opts }); }
function code(text) { return new TextRun({ text, font: MONO, size: SZ_CODE, color: "1a1a2e" }); }
function para(runs, opts = {}) { return new Paragraph({ spacing: { after: 120 }, ...opts, children: Array.isArray(runs) ? runs : [runs] }); }

function heading(text, level) {
  const sizes = { [HeadingLevel.HEADING_1]: 32, [HeadingLevel.HEADING_2]: 28, [HeadingLevel.HEADING_3]: 24 };
  return new Paragraph({
    heading: level, spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, size: sizes[level] || 28, color: BLUE })]
  });
}

function codeBlock(lines) {
  return lines.map(line => new Paragraph({
    spacing: { after: 0 },
    shading: { fill: CODE_BG, type: ShadingType.CLEAR },
    indent: { left: 200, right: 200 },
    children: [new TextRun({ text: line, font: MONO, size: SZ_CODE })]
  }));
}

function warningBlock(text) {
  return new Paragraph({
    spacing: { after: 120 },
    shading: { fill: "FEF3C7", type: ShadingType.CLEAR },
    indent: { left: 200, right: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: "F59E0B", space: 8 } },
    children: [bold("Warning: ", { color: "92400E" }), txt(text, { color: "92400E" })]
  });
}

function tipBlock(text) {
  return new Paragraph({
    spacing: { after: 120 },
    shading: { fill: "D1FAE5", type: ShadingType.CLEAR },
    indent: { left: 200, right: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: "10B981", space: 8 } },
    children: [bold("Tip: ", { color: "065F46" }), txt(text, { color: "065F46" })]
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const margins = { top: 60, bottom: 60, left: 100, right: 100 };

function hCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: BLUE, type: ShadingType.CLEAR },
    margins, verticalAlign: VerticalAlign.CENTER,
    children: [para([bold(text, { color: "FFFFFF", size: SZ_SM })], { alignment: AlignmentType.CENTER })]
  });
}
function cell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins, verticalAlign: VerticalAlign.TOP, ...opts,
    children: [para([txt(text, { size: SZ_SM })])]
  });
}
function codeCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins, verticalAlign: VerticalAlign.TOP,
    children: [para([code(text)])]
  });
}

const children = [];

// ===== TITLE =====
children.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "VoxTranslate", font: FONT, size: 72, bold: true, color: BLUE })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 100 },
  children: [new TextRun({ text: "Mac Deployment Guide", font: FONT, size: 36, color: GRAY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 400 },
  children: [new TextRun({ text: "Step-by-step setup for Mac Studio / Mac Pro", font: FONT, size: 24, color: GRAY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
  spacing: { before: 200, after: 200 }, children: []
}));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [bold("Version: "), txt("3.0")] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [bold("Date: "), txt("March 2026")] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [bold("Target: "), txt("Mac Studio / Mac Pro (Apple Silicon)")] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [bold("Estimated setup time: "), txt("15-20 minutes")] }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== PREREQUISITES =====
children.push(heading("1. Prerequisites", HeadingLevel.HEADING_1));
children.push(para([txt("Before you start, make sure your Mac meets these requirements:")]));

const reqRows = [
  ["Requirement", "Minimum", "Recommended"],
  ["macOS", "13 Ventura", "14 Sonoma or 15 Sequoia"],
  ["Chip", "M1", "M2 Pro / M2 Ultra / M4"],
  ["RAM", "16 GB", "32 GB+"],
  ["Free disk space", "20 GB", "50 GB+"],
  ["Internet", "Stable broadband", "100 Mbps+"],
];
const reqCols = [2500, 3430, 3430];
const reqTableRows = [];
reqTableRows.push(new TableRow({ children: reqRows[0].map((h, i) => hCell(h, reqCols[i])) }));
for (let r = 1; r < reqRows.length; r++) {
  reqTableRows.push(new TableRow({
    children: reqRows[r].map((c, i) => cell(c, reqCols[i],
      r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}))
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: reqCols, rows: reqTableRows }));

children.push(para([txt("")]));
children.push(para([txt("You will also need these API keys (you already have them):")]));
children.push(para([bold("ElevenLabs API Key"), txt(" - For speech-to-text transcription (Scribe v2)")]));
children.push(para([bold("Anthropic API Key"), txt(" - For AI translation and on-screen text detection (Claude)")]));

// ===== STEP 1: INSTALL DOCKER =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("2. Install Docker Desktop", HeadingLevel.HEADING_1));
children.push(para([txt("Docker runs all VoxTranslate services in isolated containers. This is a one-time install.")]));

children.push(heading("Option A: Using Homebrew (recommended)", HeadingLevel.HEADING_2));
children.push(para([txt("Open Terminal (Applications > Utilities > Terminal) and run:")]));
children.push(...codeBlock([
  "# Install Homebrew if you don't have it",
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  "",
  "# Install Docker Desktop",
  "brew install --cask docker",
]));

children.push(heading("Option B: Manual download", HeadingLevel.HEADING_2));
children.push(para([txt("Download Docker Desktop for Mac from docker.com/products/docker-desktop and install the .dmg file.")]));

children.push(para([txt("")]));
children.push(para([bold("After installing:")]));
children.push(para([txt("1. Open Docker Desktop from your Applications folder")]));
children.push(para([txt("2. Accept the terms and wait for Docker to start (you'll see the whale icon in your menu bar)")]));
children.push(para([txt("3. Verify it works by running in Terminal:")]));
children.push(...codeBlock(["docker --version"]));
children.push(para([txt("You should see something like: Docker version 27.x.x")]));

children.push(tipBlock("Enable 'Start Docker Desktop when you sign in' in Docker Desktop Settings > General so VoxTranslate auto-starts when your Mac boots."));

// ===== STEP 2: UNZIP PROJECT =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("3. Set Up the Project", HeadingLevel.HEADING_1));

children.push(heading("3.1 Unzip the project", HeadingLevel.HEADING_2));
children.push(para([txt("Place the VoxTranslate_Webapp_v3.0_full.zip file on your Desktop, then run:")]));
children.push(...codeBlock([
  "cd ~/Desktop",
  "unzip VoxTranslate_Webapp_v3.0_full.zip -d voxtranslate",
  "cd voxtranslate",
]));

children.push(heading("3.2 Create your environment file", HeadingLevel.HEADING_2));
children.push(para([txt("Copy the template and open it in a text editor:")]));
children.push(...codeBlock([
  "cp .env.example .env",
  "nano .env",
]));

children.push(para([txt("Replace the placeholder values with your actual keys:")]));
children.push(...codeBlock([
  "ELEVENLABS_API_KEY=your_actual_elevenlabs_key_here",
  "ANTHROPIC_API_KEY=your_actual_anthropic_key_here",
  "POSTGRES_PASSWORD=pick_a_strong_password",
  "SECRET_KEY=any_random_string_at_least_32_chars",
]));

children.push(para([txt("Save and exit: press Ctrl+X, then Y, then Enter.")]));

children.push(warningBlock("Never share your .env file or commit it to Git. It contains your API keys and passwords."));

// ===== STEP 3: LAUNCH =====
children.push(heading("4. Launch VoxTranslate", HeadingLevel.HEADING_1));
children.push(para([txt("From the project folder, run one command:")]));
children.push(...codeBlock(["docker compose up -d"]));

children.push(para([txt("")]));
children.push(para([txt("First launch takes 3-5 minutes as Docker downloads images and builds containers. You'll see output like:")]));
children.push(...codeBlock([
  "[+] Running 6/6",
  " ✔ Container voxtranslate-db       Started",
  " ✔ Container voxtranslate-redis    Started",
  " ✔ Container voxtranslate-api      Started",
  " ✔ Container voxtranslate-worker   Started",
  " ✔ Container voxtranslate-web      Started",
  " ✔ Container voxtranslate-proxy    Started",
]));

children.push(para([txt("")]));
children.push(para([bold("VoxTranslate is now running!")]));
children.push(para([txt("")]));

const urlRows = [
  ["Service", "URL", "Purpose"],
  ["Web App", "http://localhost:3000", "Main interface for submitting and managing jobs"],
  ["API Docs", "http://localhost:8000/docs", "Interactive API documentation (Swagger)"],
  ["Admin Panel", "http://localhost:80", "Caddy reverse proxy (same as webapp)"],
];
const urlCols = [2000, 3500, 3860];
const urlTableRows = [];
urlTableRows.push(new TableRow({ children: urlRows[0].map((h, i) => hCell(h, urlCols[i])) }));
for (let r = 1; r < urlRows.length; r++) {
  urlTableRows.push(new TableRow({
    children: urlRows[r].map((c, i) => {
      if (i === 1) return codeCell(c, urlCols[i]);
      return cell(c, urlCols[i], r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {});
    })
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: urlCols, rows: urlTableRows }));

// ===== STEP 4: LET LINGUISTS ACCESS =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("5. Give Linguists Access", HeadingLevel.HEADING_1));
children.push(para([txt("Your linguists can access VoxTranslate from any device on the same network (Wi-Fi or office LAN). No software install needed on their end.")]));

children.push(heading("5.1 Find your Mac's IP address", HeadingLevel.HEADING_2));
children.push(...codeBlock(["ipconfig getifaddr en0"]));
children.push(para([txt("This returns something like 192.168.1.45.")]));

children.push(heading("5.2 Share the URL", HeadingLevel.HEADING_2));
children.push(para([txt("Tell your linguists to open their browser and go to:")]));
children.push(...codeBlock(["http://192.168.1.45"]));
children.push(para([txt("(Replace with your actual IP address)")]));

children.push(heading("5.3 Create linguist accounts", HeadingLevel.HEADING_2));
children.push(para([txt("Use the API to create accounts for each linguist:")]));
children.push(...codeBlock([
  'curl -X POST http://localhost:8000/api/users \\',
  '  -H "Content-Type: application/json" \\',
  '  -d \'{"username": "maria", "password": "temp123",',
  '       "display_name": "Maria Santos",',
  '       "role": "linguist"}\'',
]));
children.push(para([txt("Or use the Settings page in the webapp to manage users.")]));

children.push(tipBlock("For remote access outside your network, set up Tailscale (free VPN). Install on your Mac and linguists' devices, and they can access VoxTranslate from anywhere."));

// ===== DAILY OPERATIONS =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("6. Daily Operations", HeadingLevel.HEADING_1));

children.push(heading("6.1 Common commands", HeadingLevel.HEADING_2));
const cmdRows = [
  ["What you want to do", "Command"],
  ["Check all services are running", "docker compose ps"],
  ["View live logs (all services)", "docker compose logs -f"],
  ["View pipeline worker logs only", "docker compose logs -f worker"],
  ["Restart everything", "docker compose restart"],
  ["Stop VoxTranslate", "docker compose down"],
  ["Start again after stopping", "docker compose up -d"],
  ["Rebuild after code changes", "docker compose up -d --build"],
  ["Check disk space used", "docker system df"],
  ["Clean old images/containers", "docker system prune -f"],
];
const cmdCols = [4000, 5360];
const cmdTableRows = [];
cmdTableRows.push(new TableRow({ children: cmdRows[0].map((h, i) => hCell(h, cmdCols[i])) }));
for (let r = 1; r < cmdRows.length; r++) {
  cmdTableRows.push(new TableRow({
    children: [
      cell(cmdRows[r][0], cmdCols[0], r % 2 === 0 ? { shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR } } : {}),
      codeCell(cmdRows[r][1], cmdCols[1])
    ]
  }));
}
children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: cmdCols, rows: cmdTableRows }));

children.push(heading("6.2 Processing a video", HeadingLevel.HEADING_2));
children.push(para([txt("1. Open the webapp at http://localhost:3000")]));
children.push(para([txt("2. Click 'Submit Job' and paste a YouTube URL")]));
children.push(para([txt("3. Optionally toggle 'Select specific timestamps' to process only certain portions")]));
children.push(para([txt("4. Click 'Submit' and watch the pipeline progress in real-time")]));
children.push(para([txt("5. When transcription finishes, assign to a linguist for review")]));
children.push(para([txt("6. After linguist approves, translation runs automatically")]));
children.push(para([txt("7. Linguist reviews translation, clicks 'Approve & Export DOCX'")]));
children.push(para([txt("8. Download the final DOCX from the job detail page")]));

children.push(heading("6.3 Splitting a long video", HeadingLevel.HEADING_2));
children.push(para([txt("1. Submit the video and let the AI pipeline complete")]));
children.push(para([txt("2. On the job detail page, click 'Split & Assign'")]));
children.push(para([txt("3. Enter split timestamps to divide the video into chunks")]));
children.push(para([txt("4. Assign each chunk to a different linguist")]));
children.push(para([txt("5. Click 'Split & Assign' to create all chunk jobs")]));
children.push(para([txt("6. Linguists review their chunks in parallel")]));
children.push(para([txt("7. When all chunks are approved, system auto-merges and exports final DOCX")]));

// ===== TROUBLESHOOTING =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("7. Troubleshooting", HeadingLevel.HEADING_1));

children.push(heading("Docker won't start", HeadingLevel.HEADING_2));
children.push(para([txt("Make sure Docker Desktop is running (whale icon in menu bar). If it crashed, quit and reopen from Applications.")]));

children.push(heading("'Port already in use' error", HeadingLevel.HEADING_2));
children.push(para([txt("Another app is using port 3000, 8000, or 5432. Either stop that app or change the port in docker-compose.yml.")]));

children.push(heading("Pipeline stuck on 'downloading'", HeadingLevel.HEADING_2));
children.push(para([txt("Some YouTube videos are geo-restricted or require authentication. Check the worker logs:")]));
children.push(...codeBlock(["docker compose logs worker | tail -50"]));

children.push(heading("API key errors", HeadingLevel.HEADING_2));
children.push(para([txt("Double-check your .env file has the correct keys with no extra spaces. Then restart:")]));
children.push(...codeBlock(["docker compose restart backend worker"]));

children.push(heading("Linguists can't connect", HeadingLevel.HEADING_2));
children.push(para([txt("Verify they're on the same network. Check your Mac's firewall (System Settings > Network > Firewall) isn't blocking ports 80 and 3000.")]));

children.push(heading("Out of disk space", HeadingLevel.HEADING_2));
children.push(para([txt("Video files accumulate over time. Clean old job files:")]));
children.push(...codeBlock([
  "# Remove Docker build cache",
  "docker system prune -f",
  "",
  "# Check storage volume size",
  "docker system df -v",
]));

// ===== UPDATING =====
children.push(heading("8. Updating VoxTranslate", HeadingLevel.HEADING_1));
children.push(para([txt("When you receive an updated ZIP file:")]));
children.push(...codeBlock([
  "cd ~/Desktop/voxtranslate",
  "docker compose down",
  "",
  "# Back up your .env file",
  "cp .env .env.backup",
  "",
  "# Unzip new version over existing (overwrite files)",
  "unzip -o ~/Downloads/VoxTranslate_Webapp_v4.0.zip -d .",
  "",
  "# Restore your .env file",
  "cp .env.backup .env",
  "",
  "# Rebuild and start",
  "docker compose up -d --build",
]));
children.push(para([txt("Your database and job history are preserved in Docker volumes — they survive updates.")]));

// ===== FOOTER =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: BLUE } },
  spacing: { before: 200, after: 200 }, children: []
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "VoxTranslate Deployment Guide v3.0 - Lofte Studios", font: FONT, size: SZ_SM, color: GRAY, italics: true })]
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
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT },
        paragraph: { spacing: { before: 150, after: 80 }, outlineLevel: 2 } },
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
          children: [new TextRun({ text: "VoxTranslate Deployment Guide", font: FONT, size: 16, color: GRAY, italics: true })]
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

const outputPath = "/sessions/awesome-amazing-feynman/mnt/outputs/VoxTranslate_Mac_Deployment_Guide.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log("Deployment guide generated:", outputPath);
  console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
});
