# Distributing Without Code Signing - A Practical Guide

## TL;DR: Yes, You Can Skip Signing (Especially At First)

For a niche sport with tight-knit community, **unsigned apps are totally viable**. Many indie developers start this way and only invest in signing once they have revenue to justify it.

---

## What Happens Without Code Signing?

### macOS (Unsigned)

**What users see:**
```
"Roundnet Condenser.app" cannot be opened because the developer cannot be verified.
```

**How users bypass it:**
1. Right-click the app → "Open" (first time only)
2. Click "Open" in the dialog
3. App runs normally forever after

**Alternative method:**
```bash
# User runs this command once:
xattr -cr /Applications/Roundnet\ Condenser.app
```

**Reality check:** This is how TONS of indie Mac apps distribute. Examples:
- Many open-source tools
- Developer utilities
- Niche professional software

---

### Windows (Unsigned)

**What users see:**
```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

**How users bypass it:**
1. Click "More info"
2. Click "Run anyway"
3. App installs/runs normally

**Reality check:** Users are used to this for smaller software companies. As your app gets downloaded more, Windows SmartScreen learns to trust it (reputation-based).

---

## The REAL Question: Will Your Users Accept This?

### Factors That Make Unsigned OK:

✅ **Niche community** (roundnet players know each other, word-of-mouth trust)
✅ **Low price point** ($10/mo vs $50/mo = less perceived risk)
✅ **Free tier** (users can try before trusting with payment)
✅ **Open about it** ("We're a small team, here's how to install")
✅ **Active support** (Discord/email support builds trust)
✅ **Open source option** (let users build from source if paranoid)

### Factors That Make Unsigned Risky:

❌ Non-technical users (if your users aren't tech-savvy)
❌ Enterprise customers (companies won't install unsigned)
❌ High price point (harder to justify $50/mo for unsigned app)
❌ Sensitive data (financial, health records)
❌ Mass-market product (needs low friction)

**For roundnet tournament organizers and players:** Unsigned is probably FINE.

---

## Cost Optimization Strategies

### Strategy 1: Start Unsigned, Sign Later ⭐ RECOMMENDED

**Phase 1 (Months 1-6): Unsigned**
- Cost: $0
- Provide clear installation instructions
- Build trust through quality product + support
- Get to 50-100 users

**Phase 2 (Once revenue > $500/mo): Sign macOS only**
- Cost: $99/year (Apple Developer)
- macOS is pickier than Windows, sign it first
- Notarization makes it WAY smoother
- Keep Windows unsigned for now

**Phase 3 (Once revenue > $1,500/mo): Sign everything**
- Cost: $99 + $150-300/year = ~$250-400/year
- Now you're making $1,500+/mo, $400/year is nothing
- Full professional experience

**Math:**
- 50 users × $10/mo = $500/mo = $6,000/year
- Code signing = $400/year = 6.6% of revenue
- **Totally sustainable at this point**

---

### Strategy 2: macOS-Only Launch

**Why:** macOS users are more willing to pay for software

**Approach:**
- Get Apple Developer account ($99/year)
- Sign + notarize macOS only
- Skip Windows entirely at first
- Much smoother for 50%+ of your market

**When to add Windows:**
- After you have 30+ paying macOS users
- When people ask for Windows version
- Use unsigned Windows build with instructions

---

### Strategy 3: Web App Instead ⭐ ALTERNATIVE

**Convert to web-based app:**

```
User uploads video (drag & drop)
    ↓
Video streams to your server
    ↓
Python backend processes on server (same code!)
    ↓
User downloads clips.json + final video
```

**Pros:**
✅ Zero code signing needed
✅ Works on ANY platform (even Chromebooks!)
✅ No installation friction
✅ Easier updates (just deploy)
✅ Can charge per video instead of subscription

**Cons:**
❌ Video upload = slow for large files
❌ Server costs (storage + compute)
❌ Privacy concerns (videos on your server)
❌ Need to handle video storage/deletion

**Cost analysis:**
- Storage: Cloudflare R2 = $0.015/GB/month
- Compute: Railway/Render = $5-20/month
- Typical 1GB video × 100 users/month = ~$20-50/month total

**Pricing model for web app:**
- Free: 3 videos/month
- Pro ($10/mo): Unlimited videos
- Pay-per-video: $2-5 per video processed

---

## Recommended Approach for YOUR Situation

Given:
- Niche sport (tight-knit community)
- $10/month price point
- Free tier (3 videos/month)
- Bootstrapped (low budget)

### I Recommend: Hybrid Unsigned Start

**Month 1-3: MVP Launch (Unsigned Desktop App)**

1. **Build & distribute unsigned installers**
   - macOS .dmg (unsigned)
   - Windows .exe (unsigned)

2. **Create dead-simple installation guide**
   ```markdown
   # How to Install (macOS)

   1. Download Roundnet Condenser
   2. Open the .dmg file
   3. Drag app to Applications
   4. **Important:** Right-click the app → "Open" (first time only)
   5. Click "Open" in the warning dialog
   6. You're good to go! 🎉

   (This is normal for small apps. We'll get official Apple signing
   once we have enough users to cover the $99/year cost!)
   ```

3. **Be transparent about it**
   - Add FAQ: "Why isn't this signed?"
   - Answer: "We're bootstrapping! Once we hit 50 paying users, we'll invest in official Apple/Microsoft signing to make installation smoother."

4. **Build trust other ways:**
   - Open source the code (optional but powerful)
   - Active Discord/Slack community
   - Video tutorials showing installation
   - Responsive support

**Cost: $0-25/month** (just hosting/database)

---

**Month 4-6: Get to 30-50 Users**

Focus on:
- Product quality
- Word of mouth
- Tournament partnerships
- Content creator sponsorships

**Revenue at 50 users:**
- 50 users × $10/mo = $500/month
- Apple Developer = $99/year = $8.25/month
- **Profit margin improves from 95% to 93%** (negligible difference)

---

**Month 7+: Invest in macOS Signing**

Once you have **$500+/month revenue**:
- Purchase Apple Developer ($99/year)
- Set up code signing + notarization
- Much smoother installation
- Keep Windows unsigned for now (users are used to the warning)

---

**Month 12+: Full Professional Setup**

Once you have **$1,000+/month revenue**:
- Add Windows code signing ($150-300/year)
- Now 100% smooth installation
- Total cost: ~$250-400/year
- Revenue: $12,000+/year
- **Code signing = 2-3% of revenue (totally sustainable)**

---

## Making Unsigned Work: Best Practices

### 1. Crystal-Clear Installation Instructions

**Create video tutorial:**
- Screen recording showing exact clicks
- Calm voiceover explaining "this is normal"
- 60-90 seconds max
- Host on YouTube, embed on website

**Example script:**
```
"Hi! When you first open Roundnet Condenser, macOS will show a warning
because we're a small company and haven't purchased Apple's $99/year
developer certificate yet. This is totally normal for indie software!

Here's how to install:
[show right-click → Open]

That's it! You only need to do this once. The app is safe - we're
just bootstrapping until we have enough users to cover the cost of
official signing. Thanks for supporting a small business!"
```

---

### 2. Add "Verified By Community" Badge

**On your website:**
```
✅ 247 roundnet players trust Roundnet Condenser
✅ Open source code (view on GitHub)
✅ Used by [Tournament Name], [Team Name], etc.
```

**Social proof > code signing** for niche communities

---

### 3. Offer "Build From Source" Option

For paranoid users:
```markdown
# Advanced: Build From Source

Don't trust our pre-built app? Build it yourself!

1. Clone the repo: git clone https://github.com/you/roundnet-desktop
2. Install dependencies: npm install
3. Build: npm run build
4. Your own app in dist/!

This guarantees the code matches what you downloaded.
```

---

### 4. Partner with Trusted Community Members

**Strategy:**
- Find 3-5 respected tournament organizers
- Give them free lifetime access
- Ask them to vouch for the app
- "Endorsed by [Known Player/Org]" on website

In niche sports, **reputation matters more than certificates**.

---

## Alternative: Web App Analysis

Let's actually calculate if web app makes more sense:

### Desktop App (Unsigned)

**Pros:**
- Fast (local processing)
- Private (videos never leave user's computer)
- Works offline
- Better user experience

**Cons:**
- Installation friction (unsigned warnings)
- Platform-specific builds
- User needs Python/FFmpeg installed

**Costs:**
- Month 1-6: $0-25/mo (hosting/DB)
- Month 7+: ~$35/mo (+ Apple signing)

---

### Web App

**Pros:**
- Zero installation
- Works everywhere
- No code signing needed
- Easier to update

**Cons:**
- Upload/download time
- Server costs scale with usage
- Privacy concerns
- Need to manage video storage

**Costs:**
```
Assume 100 active users, each processes 5 videos/month:
- Videos: 1GB each × 500 videos = 500GB upload
- Storage: 500GB × 1 day retention × $0.015/GB = $7.50/mo
- Compute: Railway/Render GPU instance = $50-100/mo
- CDN: Cloudflare R2 egress = $10-20/mo

Total: ~$70-130/month
```

**Revenue needed to break even:**
- $70/mo cost ÷ $10/user = 7 paying users minimum
- More realistic: 20-30 paying users for profitability

**Verdict:** Web app is MORE expensive until you have 100+ users.

---

## Hybrid Approach: Desktop + Web

**Offer both:**

1. **Desktop app** (unsigned, free tier)
   - For serious users who process lots of videos
   - "Download for unlimited local processing"

2. **Web app** (pay-per-video)
   - For casual users who don't want to install
   - "Try online: $3 per video processed"
   - No account needed, just upload & pay

**Pricing:**
- Web: $3-5 per video
- Desktop free tier: 3 videos/month
- Desktop Pro: $10/month unlimited

**Why this works:**
- Web version proves the value (no commitment)
- Power users convert to desktop (better margins)
- Casual users pay premium for convenience (web)

---

## Real-World Examples: Successful Unsigned Apps

### 1. **Blender** (3D software)
- Unsigned for YEARS
- $100M+ in donations
- Community trust > certificates

### 2. **OBS Studio** (streaming software)
- Started unsigned
- Massive adoption despite warnings
- Added signing later with funding

### 3. **Homebrew** (macOS package manager)
- Unsigned by design
- Millions of users
- Installation instructions are part of the culture

### 4. **Many indie games on itch.io**
- 99% unsigned
- Gamers are used to bypassing warnings
- Trust comes from reviews + community

**Pattern:** Niche communities accept unsigned if you:
1. Have clear instructions
2. Build trust through quality
3. Are transparent about why
4. Plan to sign eventually

---

## My Specific Recommendation for You

### Start Here (Month 1):

```
✅ Build unsigned desktop app (macOS + Windows)
✅ Create 2-minute installation video tutorial
✅ Launch with free tier (3 videos/month)
✅ Charge $10/month for unlimited
✅ Total cost: ~$15/month (Vercel + Supabase)
```

**FAQ on your website:**
```markdown
### Why does macOS say the app is from an "unidentified developer"?

We're a small bootstrapped team! Apple charges $99/year for their
developer certificate. Once we reach 50 paying users, we'll invest
in official signing to make installation smoother.

Until then, just right-click → Open (first time only). See our
[video guide](link) for the exact steps. The app is safe - 247
roundnet players already use it!
```

---

### Milestone-Based Signing Investment:

**30 users ($300/mo revenue):**
- Consider macOS signing ($99/year = $8/mo)
- Still 97% profit margin

**100 users ($1,000/mo revenue):**
- Add Windows signing (~$150/year = $12/mo)
- Now ~98% professional experience
- ~$20/mo total signing cost vs $1,000/mo revenue = 2%

---

## Cost Comparison Summary

### Scenario A: Sign Everything From Day 1
```
Apple Developer: $99/year
Windows cert: $200/year
Domain: $15/year
Hosting: $15/month
---
Year 1 total: $494

Need 50 users to break even (50 × $10/mo = $500/mo)
```

### Scenario B: Start Unsigned (RECOMMENDED)
```
Domain: $15/year
Hosting: $15/month
---
Year 1 total: $195

Need 20 users to break even (20 × $10/mo = $200/mo)
```

**Difference:** You need 60% fewer users to be profitable.

---

## Bottom Line

### For a $10/month niche product with free tier:

**Start unsigned.** Here's why:

1. **Your market will accept it**
   - Tight-knit community
   - Word-of-mouth trust
   - Clear installation guides work

2. **Economics make sense**
   - $300-400/year signing cost = 30-40 users just to break even
   - Start with $0-25/month overhead instead
   - Invest in signing once you have the revenue

3. **Faster validation**
   - Launch in 4 weeks instead of 6-8
   - Test product-market fit first
   - Don't optimize distribution until you have users

4. **Path to professional**
   - Not stuck unsigned forever
   - Add signing at 30-50 users
   - By then it's a tiny % of revenue

### Action Plan:

1. **Week 1-4:** Build app + auth + website (unsigned)
2. **Week 5:** Launch with 5-10 beta users (free)
3. **Week 6-12:** Get to 30 paying users through community
4. **Month 4:** Invest in macOS signing ($99)
5. **Month 8:** Add Windows signing if needed ($150-300)

**Start lean. Scale smart. Sign when it makes sense.**

---

## Questions You Might Have

**Q: Will people think it's a virus?**
A: Not if you're transparent. Add "Why unsigned?" to FAQ, make video tutorial, get community vouchers.

**Q: What % of users will bounce due to unsigned warning?**
A: In niche B2B software: 10-20%. In gaming communities: <5%. For roundnet (niche sport): probably 10-15%.

**Q: Should I open source the code?**
A: Consider it! "View source code on GitHub" is BETTER than code signing for technical users. Proves nothing malicious.

**Q: What if someone distributes a virus version of my app?**
A: Have ONE official download link. Put it everywhere. "Only download from roundnetcondenser.com - other sources may be unsafe."

**Q: Will this hurt conversions?**
A: Maybe 10-20% early on. But you'll make that up by:
- Launching faster
- Lower overhead
- Free tier attracting more users
- Community trust > certificates in niche markets

---

**Final Recommendation: Start unsigned. Add signing at 30-50 users. Focus on product quality first.**

Your users care about **saving hours of editing time** way more than whether macOS shows a checkmark.
