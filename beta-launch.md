# CutServe Beta Launch Kit

Everything you need to launch the beta: download instructions, video walkthrough script, tester notes template, and feedback form questions. Copy each section into Google Docs / Notion / Google Forms as needed.

---

## Table of Contents
1. [Download & Install Instructions](#1-download--install-instructions) — copy into a Google Doc or Notion page to share with testers
2. [Instructional Video Script](#2-instructional-video-script) — full walkthrough script for your screen recording
3. [Beta Tester Notes Template](#3-beta-tester-notes-template) — Google Doc template testers copy and fill in as they go
4. [Final Feedback Form Questions](#4-final-feedback-form-questions) — questions for your Google Form

---

## 1. Download & Install Instructions

> Copy this section into a Google Doc or Notion page. Replace `[DOWNLOAD_LINK]` with the actual GitHub release URL or a redirect from your domain once live.

---

### CutServe Beta — Download & Setup Guide

Thanks for joining the CutServe beta! This guide will walk you through downloading, installing, and getting started.

**Requirements:**
- macOS 12 (Monterey) or later
- Apple Silicon (M1, M2, M3, M4) or Intel Mac
- At least 4 GB of free disk space
- A roundnet match video file (.mp4 recommended)

---

#### Step 1: Download

Download the version that matches your Mac:

- **Apple Silicon (M1, M2, M3, M4):** [Download CutServe Beta (Apple Silicon)](DOWNLOAD_LINK_ARM64)
- **Intel Mac:** [Download CutServe Beta (Intel)](DOWNLOAD_LINK_X64)

> **Not sure which one?** Click the Apple menu () > **About This Mac**. If it says "Chip: Apple M1/M2/M3/M4" download Apple Silicon. If it says "Processor: Intel" download Intel.

---

#### Step 2: Install

1. Open the downloaded `.dmg` file
2. Drag the **CutServe** icon into the **Applications** folder
3. Close the DMG window and eject it (right-click > Eject in Finder)

---

#### Step 3: First Launch (Important!)

Because CutServe is in beta and not yet signed with an Apple certificate, macOS will block it the first time. Here's how to open it:

1. Open **Applications** in Finder and double-click **CutServe**
2. You'll see a warning: *"CutServe can't be opened because Apple cannot check it for malicious software."* — click **Done** (not Move to Trash)
3. Open **System Settings** > **Privacy & Security**
4. Scroll down — you'll see: *"CutServe was blocked from use because it is not from an identified developer."*
5. Click **Open Anyway**
6. Enter your password if prompted
7. Click **Open** on the final confirmation dialog

> You only need to do this once. After the first launch, CutServe will open normally.

---

#### Step 4: Create an Account

1. When CutServe opens, you'll see the login screen
2. Click **Sign Up** and create an account with your email and a password
3. You'll be logged in automatically

> Free accounts get **3 exports per month**. This limit is per device, not per account.

---

#### Step 5: You're Ready!

You should now see the CutServe dashboard. Follow the instructional video (linked below) to learn how to:
- Import a match video
- Set court zones
- Process the video with AI
- Edit and organize clips
- Export your highlight reel

**[Watch the Walkthrough Video](VIDEO_LINK)**

---

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| "App is damaged" error | Open Terminal, run: `xattr -cr /Applications/CutServe.app` then try again |
| App won't open at all | Make sure you're on macOS 12+ and downloaded the right version for your Mac (Apple Silicon vs Intel) |
| Black screen on video import | Make sure your video is .mp4 format. Other formats may not work correctly |
| Processing seems stuck | Processing can take 5–15 minutes depending on video length. Check the progress bar |
| Export takes a long time | Exports typically take 5–10 minutes. The progress bar will show estimated progress |
| "Source video not found" error | The original video file was moved or deleted. Move it back to its original location |

**Still stuck?** Send a message to [YOUR_CONTACT — IG DM, email, etc.] with a screenshot of the error.

---

## 2. Instructional Video Script

> Use this as a guide while screen recording. Aim for 5–8 minutes total. Record with your screen capture tool of choice (QuickTime, OBS, Loom, etc.)

---

### CutServe Beta — Full Walkthrough

#### INTRO (0:00 – 0:30)
**On screen:** CutServe splash/logo or the login screen

> "Hey everyone — thanks for signing up for the CutServe beta. In this video I'm going to walk you through the entire process, from importing your match video to exporting a finished highlight reel. The whole thing takes about 15–20 minutes depending on your video length, and most of that is just the AI processing in the background."

> "If you haven't installed the app yet, check the download guide linked below this video."

---

#### STEP 1: CREATE A PROJECT (0:30 – 1:30)
**On screen:** Dashboard (empty state)

> "Once you're logged in, you'll land on the dashboard. To get started, click the **New Project** button."

- Click **New Project**
- Select a match video file (.mp4)
- Give the project a name (e.g., "Nationals Pool Play G1")

> "I'm going to use a clip from [describe your video]. Any standard roundnet match video will work — just make sure it's an MP4 file. The video should ideally be a full game or a few points filmed from a fixed-ish angle."

---

#### STEP 2: SET COURT ZONES (1:30 – 3:00)
**On screen:** Zone Wizard

> "Now CutServe needs to know where the net is. You'll click four points on the video to outline the court zone. This helps the AI understand the game."

- Click the 4 corner points of the court/net area
- Show how the zone highlights as you click
- If you make a mistake, show how to reset/redo

> "Don't worry about being pixel-perfect here — just get the general area of the net and the playing zone. The AI is pretty forgiving."

- Click **Start Processing** (or whatever the confirm button says)

> "Now CutServe's AI engine is going to analyze the video. This usually takes about 5–15 minutes depending on how long your video is. You can leave the app open and come back — it'll keep processing in the background."

---

#### STEP 3: PROCESSING (3:00 – 3:30)
**On screen:** Processing progress screen

> "You'll see a progress bar here. Once it hits 100%, CutServe will automatically detect the individual rallies and cut them into clips."

*[You can either fast-forward this part, or cut and resume when processing is done]*

> "And it's done — CutServe found [X] clips in this video. Let's go take a look."

---

#### STEP 4: MATCH SETUP (3:30 – 4:30)
**On screen:** Match Setup wizard

> "Before we jump into editing, CutServe asks you to set up the match — team names, player names. This is what gets displayed in the broadcast overlay during export."

- Enter team names (e.g., "Team Alpha" vs "Team Bravo")
- Enter player names for each team
- Click through to confirm

> "If you don't want overlays in your export, you can skip this or fill in placeholder names — but I'd recommend adding real names since it makes the final product look way better."

---

#### STEP 5: EDIT CLIPS (4:30 – 6:00)
**On screen:** Editor view

> "Now we're in the editor. On the left you'll see all the clips the AI detected. You can click on any clip to preview it."

Walk through:
- **Playing a clip** — click to select, use play button or click the video
- **Keeping/trashing clips** — show how to mark clips as keep or trash
- **Reordering** — drag clips to reorder if supported
- **Adjusting clip boundaries** — show the trim controls if applicable
- **Adding stats** — show the stat type dropdown (ace, stuff block, etc.) for each clip

> "The goal here is to go through each clip, keep the ones you want in your highlight reel, trash the ones that aren't great, and optionally tag each one with a stat — like ace, kill, stuff block. This is what drives the stat screen at the end of your export."

> "Once you're happy with your selection, click **Save** to save your edits."

---

#### STEP 6: EXPORT (6:00 – 7:30)
**On screen:** Export Studio

> "Now the fun part — exporting. Click the **Export** button to open the Export Studio."

Walk through:
- **Overlay settings** — show the broadcast overlay options (template, custom)
- **Stat screen** — toggle the end-of-video stat screen on/off
- **Resolution** — 720p vs 1080p
- **Preview** — show how the live preview looks with overlay

> "When you're ready, click **Export Studio** at the bottom. You'll pick a save location, and then the render starts. This usually takes about 5–10 minutes — you'll see a progress bar."

- Show the progress bar animating
- *[Fast-forward or cut to completion]*

> "And that's it! Your highlight reel is ready. Open it up and check it out."

---

#### OUTRO (7:30 – 8:00)
**On screen:** The finished exported video playing, or back on the dashboard

> "That's the full CutServe workflow. To recap: import video, set zones, let the AI process, edit your clips, and export."

> "As a beta tester, your feedback is super valuable. I've shared a Google Doc template and a feedback form — please fill those in as you go. Note anything that felt confusing, any bugs you hit, or features you wish existed."

> "Thanks for testing CutServe — let's make roundnet content easier to create."

---

## 3. Beta Tester Notes Template

> Create a new Google Doc with this content. Share the template as "Anyone with the link can view." Tell testers to **File > Make a copy** and fill in their copy as they use the app.

---

### CutServe Beta — Tester Notes

**Your Name:**
**Email (same as your CutServe account):**
**Mac Model (e.g., MacBook Air M2):**
**macOS Version (e.g., 15.2):**
**Date Started Testing:**

---

#### How to Use This Doc

As you work through CutServe, jot down notes under each section below. Don't worry about being formal — bullet points, screenshots, and quick thoughts are all helpful. The goal is to capture your real experience as it happens.

For bugs: describe what you did, what you expected, and what actually happened. Screenshots are very helpful (Cmd+Shift+4 to capture a region, then paste into this doc).

---

#### 1. Download & Install

- [ ] Downloaded the DMG successfully
- [ ] Installed to Applications
- [ ] Got past the macOS security warning
- [ ] App launched successfully

**Notes / issues:**


---

#### 2. Account Creation & Login

- [ ] Created an account
- [ ] Logged in successfully
- [ ] Saw the dashboard

**Notes / issues:**


---

#### 3. Importing a Video & Setting Zones

- [ ] Created a new project
- [ ] Imported a video file
- [ ] Set the 4 court zone points
- [ ] Started processing

**Video details:** (length, file size, what camera/angle)


**Notes / issues:**


---

#### 4. AI Processing

- [ ] Processing started
- [ ] Progress bar showed updates
- [ ] Processing completed
- [ ] Clips were detected

**How long did processing take?**

**How many clips were detected?**

**Notes / issues:**


---

#### 5. Match Setup

- [ ] Entered team names
- [ ] Entered player names
- [ ] Completed setup

**Notes / issues:**


---

#### 6. Editing Clips

- [ ] Reviewed clips in the editor
- [ ] Kept/trashed clips
- [ ] Added stats to clips
- [ ] Saved edits

**How accurate was the AI at detecting rallies?** (e.g., "Got 90% of them, missed a few short ones")


**Was anything confusing about the editor?**


**Notes / issues:**


---

#### 7. Export

- [ ] Opened Export Studio
- [ ] Configured overlay settings
- [ ] Started export
- [ ] Export completed
- [ ] Opened and watched the final video

**How long did the export take?**

**How did the final video look?**


**Notes / issues:**


---

#### 8. General Impressions

**What did you like most?**


**What was the most frustrating part?**


**What features would you want added?**


**Would you use this for your own roundnet content? Why or why not?**


**Any other thoughts?**


---

#### Bug Log

Use this table to track any bugs you encounter. Add rows as needed.

| # | Where in the app | What happened | What you expected | Screenshot? |
|---|-----------------|---------------|-------------------|-------------|
| 1 |                 |               |                   |             |
| 2 |                 |               |                   |             |
| 3 |                 |               |                   |             |
| 4 |                 |               |                   |             |
| 5 |                 |               |                   |             |

---

## 4. Final Feedback Form Questions

> Create a Google Form with these questions. Set it up to collect email addresses. Add a description at the top like:
>
> *"Thanks for testing CutServe! Please fill out this form after you've had a chance to use the app. It should take about 5 minutes. Your feedback directly shapes what we build next."*

---

### Section 1: About You

**1. Email address** (auto-collected by Google Forms)

**2. What's your experience level with roundnet?**
- Just started (< 1 year)
- Intermediate (1–3 years)
- Competitive / tournament player (3+ years)

**3. How often do you film roundnet games?**
- Never
- Occasionally (a few times a year)
- Regularly (monthly+)
- Every game

**4. Have you ever edited roundnet highlights before?**
- No, never
- Yes, manually (iMovie, Premiere, CapCut, etc.)
- Yes, with another tool

---

### Section 2: Installation & Setup

**5. How easy was it to download and install CutServe?**
*(Scale: 1 = Very difficult, 5 = Very easy)*

**6. Did you run into the macOS security warning? If so, were the instructions clear enough to get past it?**
- No warning
- Yes, and the instructions were clear
- Yes, and I needed extra help
- Yes, and I couldn't get past it

**7. Did you have any issues creating an account or logging in?**
*(Short answer)*

---

### Section 3: Using the App

**8. How intuitive was the zone-setting step?**
*(Scale: 1 = Very confusing, 5 = Very intuitive)*

**9. How long did AI processing take for your video?**
- Under 5 minutes
- 5–10 minutes
- 10–20 minutes
- Over 20 minutes
- It didn't finish / errored out

**10. How accurate was the AI at detecting individual rallies?**
*(Scale: 1 = Missed most of them, 5 = Caught almost everything)*

**11. How easy was it to edit and organize clips?**
*(Scale: 1 = Very confusing, 5 = Very easy)*

**12. How was the export experience?**
*(Scale: 1 = Very frustrating, 5 = Smooth and easy)*

---

### Section 4: The Final Product

**13. How would you rate the quality of the exported highlight video?**
*(Scale: 1 = Poor, 5 = Great)*

**14. What did you think of the broadcast overlay?**
- Loved it
- It was fine
- Didn't like the style
- Didn't use it

**15. Would you share the exported video on social media?**
- Yes, definitely
- Maybe, with some improvements
- No

---

### Section 5: Overall

**16. Overall, how would you rate your experience with CutServe?**
*(Scale: 1 = Very poor, 5 = Excellent)*

**17. How likely are you to recommend CutServe to someone in the roundnet community?**
*(Scale: 1 = Not at all, 10 = Absolutely — NPS style)*

**18. What was the single best thing about CutServe?**
*(Short answer)*

**19. What was the single most frustrating thing?**
*(Short answer)*

**20. What's the #1 feature you'd want added?**
*(Short answer)*

**21. Would you pay for CutServe? If so, what feels like a fair price?**
- No, I wouldn't pay
- $5–10/month
- $10–20/month
- One-time purchase under $50
- One-time purchase $50–100
- Other: ___

**22. Link to your Beta Tester Notes doc** (paste the link to your Google Doc copy)
*(Short answer — URL)*

**23. Anything else you want to share?**
*(Long answer)*

---

## Launch Checklist

Before you send the email to your 30+ testers:

- [ ] Upload the latest build to GitHub Releases (done — v1.0.0-beta.13)
- [ ] Copy Section 1 into a Google Doc or Notion page with the real download link
- [ ] Record the instructional video using Section 2 as your script
- [ ] Upload video to YouTube (unlisted) or Loom and add the link to the instructions doc
- [ ] Copy Section 3 into a Google Doc, set sharing to "Anyone with link can view"
- [ ] Create the Google Form using Section 4 questions
- [ ] Add links to the notes template and feedback form in the instructions doc
- [ ] Test the full flow yourself end-to-end on a clean account
- [ ] Draft the email/DM to send to your IG signups
- [ ] Include note that this beta is **Mac only** (Apple Silicon + Intel supported)
- [ ] Set a deadline for feedback (e.g., 2 weeks from launch)
