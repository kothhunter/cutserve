# CutServe Docs — Full Copy

All copy for the CutServe documentation site. Each section maps to a page in the sidebar.
Drop in your screenshots wherever a `[SCREENSHOT: ...]` callout appears.

---

## Page 1 — Getting Started

### Title: Getting Started with CutServe

**Intro paragraph:**
CutServe turns raw match footage into a polished highlight reel automatically. You shoot the video, tell the app where players serve from, and it does the rest — detecting every rally, organizing your clips, and letting you fine-tune everything before you export. This guide walks you through the whole process from download to your first reel.

---

### Step 1 — Download and Install

Head to [cutserve.app/download](https://cutserve.app/download) and download the latest version for macOS.

Once the download finishes:
1. Open the `.dmg` file from your Downloads folder
2. Drag **CutServe** into your Applications folder
3. Open CutServe from Applications or Spotlight

> **First launch on macOS:** If you see a warning that CutServe "cannot be opened because the developer cannot be verified," right-click the app icon and choose **Open**, then click **Open** again in the dialog. You only need to do this once.

**System requirements**
- macOS 12 Monterey or later
- Apple Silicon (M1/M2/M3) or Intel Mac
- At least 4 GB of free disk space recommended for video processing

---

### Step 2 — Create Your Account

CutServe requires a free account to track your projects and export usage across sessions.

1. On first launch, you'll land on the sign-in screen
2. Click **Sign up** to create a new account with your email and a password
3. Check your inbox for a confirmation email and click the link inside
4. Return to CutServe and sign in

Your account works on the web at [cutserve.app](https://cutserve.app) as well as inside the desktop app — the same login gets you both.

> **Free plan:** Every account starts on the free plan, which includes 3 exports per month. You can tag stats, edit clips, and use every editor feature without limits. Exports are the only thing metered.

---

### Step 3 — Import Your First Video

From the dashboard, click **+ New Project**.

A file picker will open filtered to MP4 files. Select your match recording and click **Open**.

CutServe will:
- Create a new project named after your video file
- Open it directly into **Zone Setup**, where you'll mark the four serving positions

> **File format:** CutServe currently supports `.mp4` files only. If your footage is in another format (MOV, MTS, AVI), convert it to MP4 first using a free tool like HandBrake before importing.

> **File location:** Your original video file stays exactly where it is. CutServe never moves or modifies your source footage.

---

### What Happens Next

Once you've imported a video, the flow is:

| Stage | What you do |
|---|---|
| **Zone Setup** | Draw four trapezoids around the serving positions |
| **AI Processing** | CutServe analyzes the footage (runs automatically) |
| **Editing** | Review clips, trim timing, tag stats |
| **Export** | Render the final reel or open Broadcast Studio |

Each stage is covered in its own guide below.

---

---

## Page 2 — Zone Setup

### Title: Setting Up Your Serving Zones

**Intro paragraph:**
Zones are the most important step in getting accurate results. They tell the AI exactly where players start each point — so it knows when a serve is happening, who's serving, and where to look for rally action. Take your time here. A well-drawn set of zones leads to noticeably better clip detection.

---

### What Are Zones?

In roundnet, every point starts with one player serving from one of four positions around the net. CutServe needs to know where those four positions are in your specific video — because camera angle, distance, and court setup vary every time.

You'll draw **four trapezoids**, one for each serving position. The trapezoids mark the area a player occupies when they're starting a point — both when serving and when receiving.

[SCREENSHOT: Finished zone setup with all four trapezoids drawn, labeled 1–4]

---

### Finding the Right Frame

Before you draw anything, scrub to a frame where the court is clearly visible and players are in their starting positions.

**Tips for picking a good frame:**
- Look for a frame at least 2 minutes into the video, after teams have settled into the match
- Ideally find a moment right before a serve — players will be in their natural starting positions
- The net and all four positions should be unobstructed
- Avoid frames where players are mid-movement, jumping, or walking between points

Use the **Frame Picker** scrubber at the bottom of the Zone Setup screen to seek through your video. You don't need to be precise to the exact second — anywhere that gives you a clear, still view of the court works fine.

[SCREENSHOT: Frame picker scrubber with a good frame selected showing all four player positions]

---

### How to Draw a Zone

Each zone takes **four clicks** — one for each corner of the trapezoid.

1. Click at the first corner of the zone
2. Click at the second corner
3. Click at the third corner
4. Click the fourth and final corner — the zone closes automatically

The zone fills in with a tinted overlay and gets labeled with its number. Repeat for all four positions.

**Keyboard shortcuts while drawing:**
- `Esc` — Cancel the zone you're currently drawing (start over)
- `Backspace` — Remove the last point you placed
- **Undo button** — Removes the last completed zone, or the last point if a zone is in progress

[SCREENSHOT: In-progress zone with three points placed and the fourth about to be clicked]

---

### How Big to Make the Boxes

**Make them generous.** This is the single most important thing to get right.

The zone should cover the full area a player might occupy when starting a point from that position — not just where their feet are in one specific frame. Players shift, lean, and approach the net slightly differently on every serve.

**Serving position:**
The box should comfortably contain the server's entire body from head to foot, with a few extra inches of margin on each side. If the server takes a small step before releasing, that step should still land inside the zone.

**Receiving position:**
At minimum, **at least one foot of the receiver must be inside the box at the moment of serve**. When drawing the receiving zones, make sure the box extends far enough in the direction receivers tend to stand. When in doubt, draw the box larger — a zone that's slightly too big causes far fewer missed clips than one that's slightly too small.

[SCREENSHOT: Side-by-side comparison of a well-sized zone vs. a zone that's too tight]

**The trapezoid shape:**
Zones don't have to be perfect rectangles. Because of camera perspective, the court looks wider at the front and narrower toward the back. Draw your zones to match what you actually see on screen — a natural trapezoid shape that follows the perspective of the footage.

[SCREENSHOT: Trapezoid drawn with perspective-matching shape around a player position]

---

### A Note on All Four Positions

The four zones correspond to the four starting positions in a standard roundnet game:
- Two diagonal positions for Team 1 (one server, one partner)
- Two diagonal positions for Team 2 (one receiver, one partner)

Draw them in any order. CutServe doesn't assign zone numbers to specific players — it uses all four together to understand when a serve is starting.

> **Not sure which corners to click?** Imagine drawing a box around where the player's shoes would be planted, then extend it upward to roughly waist height. Four clicks, roughly rectangular, centered on the player's position.

---

### Finishing Zone Setup

Once all four zones are drawn, the **Continue →** button activates. Click it to save your zones and start the AI processing step.

Processing runs in the background. You'll see a progress indicator on the project card in the dashboard. Depending on video length and your Mac's speed, it typically takes a few minutes per hour of footage.

> You don't need to keep CutServe open while it processes — but don't quit the app until processing completes, or you'll need to restart it.

---

---

## Page 3 — Editing Your Clips

### Title: Editing Guide

**Intro paragraph:**
After processing, CutServe hands you a timeline of every detected rally — trimmed, labeled by type, and ready to review. The editor is where you shape the final reel: cutting bad clips, tightening timing, tagging what happened on each point, and getting everything exactly right before export.

---

### The Editor Layout

[SCREENSHOT: Full editor layout with labels pointing to each panel]

The editor has four main areas:

**Sub-action bar (top)** — Save, Play All, Export, Settings, and Keybinds buttons

**Video player (center-left)** — Plays the selected clip in a loop. Click the video to play/pause.

**Right panel** — Two collapsible sections: **Stats** (for tagging what happened) and **Clipping** (for adjusting clip timing)

**Timeline (bottom)** — A horizontal filmstrip of all detected clips. Click any clip to jump to it.

---

### Navigating Clips

**With the mouse:** Click any clip card in the timeline to select it and jump to it in the video player.

**With the keyboard:**
- `→` — Next clip
- `←` — Previous clip

The video loops the selected clip automatically so you can watch it as many times as you need.

---

### Trimming Clip Timing

Every clip starts with timing the AI detected. It's usually close, but you'll often want to tighten the start or end by a second or two.

**The fastest workflow — keyboard only:**

1. Select a clip and watch it play
2. At the exact moment the clip should start, press `W` — this sets the start point to wherever the playhead is right now
3. Keep watching. At the exact moment it should end, press `S` — this sets the end point

That's it. You can move through an entire reel tagging and trimming without touching the mouse.

**Nudge buttons (mouse):**
If you prefer clicking, the Clipping panel has nudge buttons for fine-tuning:

| Button | What it does |
|---|---|
| `-1s` | Move the point back 1 second |
| `-.1s` | Move the point back 0.1 seconds |
| **Start Here / End Here** | Set to current playhead position |
| `+.1s` | Move the point forward 0.1 seconds |
| `+1s` | Move the point forward 1 second |

**All nudge keyboard shortcuts:**

| Key | Action |
|---|---|
| `Q` | Nudge start back 1 second |
| `Shift + Q` | Nudge start back 0.1 seconds |
| `E` | Nudge start forward 1 second |
| `Shift + E` | Nudge start forward 0.1 seconds |
| `A` | Nudge end back 1 second |
| `Shift + A` | Nudge end back 0.1 seconds |
| `D` | Nudge end forward 1 second |
| `Shift + D` | Nudge end forward 0.1 seconds |

> **Pro tip:** The W/S workflow is the fastest way to edit. Watch the clip at normal speed, hit W when it should start, then hit S the instant it should end. You can knock out an entire match's worth of clips in a few minutes this way.

---

### Trashing and Restoring Clips

Not every detected clip is worth keeping. If a clip is a false positive, a duplicate, or just not good enough, trash it.

**To trash a clip:** Click the `✕` button on its timeline card, or press `Delete` / `Backspace` with the clip selected.

Trashed clips turn gray and are excluded from export. They stay in the timeline so you can bring them back.

**To restore a clip:** Click the `↩` button on a trashed clip's card.

---

### Adding Clips Manually

If the AI missed a rally, you can add it yourself.

Click the **+ Add** button in the timeline header. A dialog lets you enter a start and end time in seconds. The new clip is inserted in chronological order.

> **Tip:** Seek the video to roughly where the rally starts before clicking + Add — the dialog pre-fills with your current playhead position.

---

### Play All Mode

Click **Play All** in the sub-action bar to watch every kept clip back-to-back, in order, as if it were the finished reel. This is the best way to review pacing and see how the edit flows.

Click **⏹ Stop** to exit Play All mode and return to single-clip editing.

---

### Saving Your Work

Click **Save** at any time to write your edits to disk. CutServe saves your clip list, timing adjustments, stat tags, and player assignments — so you can close the app and pick up exactly where you left off.

> Save early and often. The app doesn't auto-save during editing sessions.

---

---

## Page 4 — Stat Tagging

### Title: Stat Tagging Reference

**Intro paragraph:**
Stat tagging connects each clip to what actually happened in the point. Tags drive the automatic scoreboard in the editor, power the stats screen in Broadcast Studio, and give your highlight reel context beyond just "here's a cool rally."

---

### How Tagging Works

Select a clip, then click a stat button in the right panel — or press the corresponding number key. Some stats ask you to select which player(s) were involved before confirming.

Every tagged clip gets marked **Done** (shown with a checkmark in the timeline). Untagged clips remain **Pending**. You don't have to tag every clip to export, but tagged clips unlock the full scoreboard and stats overlay in Broadcast Studio.

---

### Stat Types

**ACE** `Key: 1`
The serve hits the net and is unreturnable. The serving team wins the point without a rally.

**DOUBLE FAULT** `Key: 2`
Two consecutive service errors. The point goes to the receiving team.

**SERVICE BREAK** `Key: 3`
The server wins the point through direct service pressure — the return is weak or forced by the quality of the serve, and the rally is brief and dominated from the start.

**SIDEOUT** `Key: 4`
A clean return with no defensive touches. The receiving team gets the serve back in a straightforward exchange.

**DEFENSIVE BREAK** `Key: 5`
A point won after one or more defensive touches by both sides. Use this when there's a genuine back-and-forth defensive exchange and one team eventually wins it. You'll be asked to log the touch sequence in order — click each player's name as they touch the net, then confirm.

**DEFENSIVE HOLD** `Key: 6`
Similar to a Defensive Break, but the team that was already serving (holding) wins the point after a defensive exchange from both sides. The distinction is which team wins: Break = receiving team wins, Hold = serving team wins. Log the touch sequence the same way.

**ERROR** `Key: 7`
An unforced error by a specific player — a dropped catch, a bad hit, a net violation. Select exactly one player when prompted.

**NONE** `Key: 8`
Use this to tag a clip as reviewed without assigning a specific stat. Useful for clips you want to keep in the reel that don't fit neatly into another category.

---

### Tagging Players for Defensive Stats

When you select **Defensive Break**, **Defensive Hold**, or **Error**, a player picker appears.

[SCREENSHOT: Player picker overlay showing the four players with team labels]

- For **Error**: click exactly one player — the one who made the mistake
- For **Defensive Break / Hold**: click each player in the order they touched the net. The same player can appear multiple times. The **last touch is the player who won the point**. Click **← Undo last** if you make a mistake in the sequence, then confirm when the sequence is complete.

> **Why does touch order matter?** The sequence is used to generate accurate rally flow stats in Broadcast Studio — showing how many touches each player had, in what order, across the whole match.

---

### Keyboard Shortcuts for Tagging

Press `1` through `8` with a clip selected to instantly apply that stat. If the stat requires player selection, the player picker will open automatically. This keeps your hands on the keyboard for a fast tagging rhythm.

---

---

## Page 5 — Export and Broadcast Studio

### Title: Export and Broadcast Studio

**Intro paragraph:**
When your clips are edited and tagged, CutServe can render the final reel two ways: a quick export that stitches your clips into a clean MP4, or Broadcast Studio — a full overlay editor where you add team names, score graphics, stat screens, and custom branding before rendering.

---

### Quick Export

Click **Export** in the sub-action bar to render immediately without opening Broadcast Studio.

You'll be prompted to choose a save location and filename. CutServe then renders every kept clip into a single MP4 in order, with no overlays.

Use quick export when you want a clean, unbranded cut without any graphics.

> **Export limits:** Free accounts get 3 exports per month. Broadcast Studio and quick export both count toward the same limit. Exports reset on the first of each month.

---

### Opening Broadcast Studio

Click **Export** while in the editor to open Broadcast Studio (if your account has exports available).

Broadcast Studio is a full-screen overlay editor with a preview panel and a configuration sidebar.

[SCREENSHOT: Broadcast Studio overview with preview and sidebar labeled]

---

### Team and Match Info

The top section of the Studio sidebar shows the team names, player names, and current score pulled from your Match Setup. These populate automatically — you don't need to re-enter them.

If anything looks wrong (wrong team name, wrong player), go back to the editor and click **Settings** to update your Match Setup, then return to Broadcast Studio.

---

### Overlays

Broadcast Studio includes two overlay modes:

**Preset overlays**
Built-in graphic templates that add a score bar, team names, and a subtle CutServe brand mark to your clips. Select a preset from the dropdown and it previews instantly.

**Custom PNG overlay**
Upload your own PNG file — a sponsor logo, a team graphic, a custom lower-third — and it's composited over every clip in the reel.

**To upload a custom overlay:**
1. In the Studio sidebar, scroll to the **Overlay** section
2. Click **Upload Custom PNG**
3. Select your PNG file — it should be the same resolution as your source video (typically 1920×1080) with a transparent background
4. The overlay previews immediately in the video player

[SCREENSHOT: Broadcast Studio with a custom PNG overlay active in the preview]

> **Design tip:** Export your overlay PNG from Figma, Photoshop, or Canva at exactly 1920×1080 with a transparent (alpha) background. Keep important content away from the very edges so it doesn't get cropped on different aspect ratios.

---

### The Stats Screen

Broadcast Studio can generate an automatic stats screen to insert at the beginning or end of your reel. It pulls from your stat tags to show:
- Final score
- Point breakdown by stat type
- Individual player touch counts (if Defensive stats were tagged)

Toggle **Include Stats Screen** in the sidebar to add it.

---

### Rendering

When your overlay and settings look right, click **Render** to export the final video.

Choose a save location when prompted. Rendering runs in the background — you'll see a progress indicator and get a notification when it's done.

Rendered files are standard MP4s, ready to upload directly to YouTube, Instagram, or share in a group chat.

---

---

## Page 6 — FAQ

### Title: Frequently Asked Questions

---

**Why is my video not loading in Zone Setup or the editor?**

CutServe plays video directly from the original file location — it doesn't copy your footage. If you moved, renamed, or deleted the video file after creating the project, CutServe can no longer find it.

To fix it: move the video back to its original location, or delete the project and reimport from the new location.

---

**What do I do if the AI missed a bunch of rallies?**

A few missed clips are normal, especially with challenging footage (low angle, partial court view, obstructed zones). You can always add missed clips manually using the **+ Add** button in the timeline.

If the detection quality is consistently poor across a whole video, the most common cause is zones that were too small or drawn during a frame where players weren't in their natural positions. Delete the project, reimport the video, and redraw the zones with more generous coverage.

---

**Can I redo my zones without starting over?**

Not currently — zone setup is a one-time step per project. If you need to adjust your zones, the cleanest path is to delete the project and reimport the video. Your original video file is never touched, so nothing is lost.

---

**Processing has been running for a long time. Is it stuck?**

Processing time depends on video length and your Mac's performance. A one-hour match typically takes 5–15 minutes on an M-series Mac. If the progress bar has been stuck at the same percentage for more than 10 minutes, try closing and relaunching CutServe — processing will need to be restarted from the dashboard.

---

**Can I use footage from multiple cameras or multiple files?**

No — each project takes a single continuous MP4 file. If your match was recorded across multiple files (e.g., your camera split the recording), you'll need to merge them into one file first before importing. A free tool like [HandBrake](https://handbrake.fr) or iMovie can join video files.

---

**What happens when I hit my free export limit?**

You can keep editing indefinitely. The export limit only prevents rendering the final video. When you try to export after reaching your limit, CutServe will show you how many exports you've used and give you the option to upgrade. Limits reset at the start of each calendar month.

---

**Can I use CutServe offline?**

Almost entirely. All video processing and editing happens locally on your Mac — no upload required. The only time an internet connection is needed is when logging in or syncing account data. You can edit a full match on an airplane with no connection.

---

**Where are my project files stored?**

CutServe stores all project data in a hidden application folder at:

`~/Library/Application Support/CutServe/`

Inside you'll find `projects.json` (the project index) and a `projects/` folder with one subdirectory per project. You generally don't need to touch these files directly — use the **Delete** button in the dashboard to remove projects cleanly.

> Don't move or rename files inside the projects folder manually. CutServe tracks files by their expected paths and will lose track of them if they're moved outside the app.

---

**How do I completely reset CutServe and start fresh?**

To delete all projects: delete them one by one from the dashboard using the trash icon.

To fully reset the app (including account logout and all data): delete the folder at `~/Library/Application Support/CutServe/` and relaunch. You'll be prompted to log in again, and the project list will be empty.

---

**I have a question that isn't answered here.**

Reach out at [cutserve.roundnet@gmail.com](mailto:cutserve.roundnet@gmail.com) and we'll get back to you.

---

*Last updated: 2025*
