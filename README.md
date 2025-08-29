# GitHub Authentication & Guestbook Automation

This repository contains multiple solutions for automating GitHub login and interacting with a guestbook application while bypassing anti-bot detection systems.

## Installation
```
git clone https://github.com/Tejas-Dherange/Web-Automato
cd Web-Automato
npm i
```
-run files as per their functionality given below

## The Challenge

The challenge involves:
1. Automating login to GitHub which has sophisticated bot detection
2. Authorizing a third-party application (guestbook)
3. Adding comments to the guestbook

## Solution Approaches

We've developed several approaches with increasing sophistication to bypass detection:

### 1. Basic Automation (`human_login.js`)

Our initial approach using basic Playwright automation with added human-like behavior:
- Variable typing speeds
- Natural mouse movements
- Random delays
- Error handling for CAPTCHA and 2FA challenges

```
node human_login.js
```

### 2. Pre-authenticated Browser Session (`pre_auth_login.js`)

This approach creates and uses a persistent browser profile:
1. First run with manual login
2. Subsequent runs reuse the authenticated session

```
# First run - requires manual login
MANUAL_LOGIN=true node pre_auth_login.js

# Subsequent runs - uses saved session
node pre_auth_login.js
```

### 3. Chrome Profile Integration (`chrome_profile_login.js`) - RECOMMENDED

The most reliable approach that uses your actual Chrome browser profile:
- Connects to your existing Chrome installation
- Inherits all cookies, extensions, and fingerprints
- Completely bypasses detection mechanisms
- Requires being logged into GitHub in your normal Chrome browser

```
node chrome_profile_login.js
```

## Anti-Detection Techniques Used

1. **Browser Fingerprint Manipulation**
   - Override automation detection properties
   - Mask WebDriver presence
   - Add fake plugins and modify navigator properties

2. **Human-like Behavior**
   - Natural mouse movement with bezier curves
   - Variable typing speeds with occasional mistakes
   - Realistic pauses and hesitations
   - Random hover behavior

3. **Persistent Browser Context**
   - Maintain cookies and local storage
   - Preserve authenticated sessions

4. **Real Chrome Profile Integration**
   - Use existing authentication
   - Inherit actual browser fingerprint
   - Leverage installed extensions for more natural appearance

## Troubleshooting

If you encounter issues with GitHub login:

1. **Rate Limiting**
   - GitHub limits login attempts. Wait at least 1 hour between attempts.

2. **Security Challenges**
   - If GitHub presents CAPTCHA or 2FA, use the Chrome Profile Integration approach.

3. **Account Flagging**
   - If your account gets flagged for automated access, log in manually through your browser and verify account through email if prompted.

4. **Path Issues**
   - Adjust Chrome paths in `chrome_profile_login.js` if your installation is in a non-standard location.

## Best Practices

1. Always use the Chrome Profile Integration approach for the most reliable results
2. Log into GitHub manually at least once before running automation
3. Keep browser windows visible (non-headless) to monitor progress
4. Use screenshots to diagnose issues

## Dependencies

- Playwright
- Node.js v14+
