import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Chrome Profile Integration for Maximum Stealth
 * 
 * This script uses your actual Chrome profile to bypass all anti-bot measures.
 * It works by connecting to your real Chrome browser where you're already logged in.
 * 
 * Pre-requisites:
 * 1. You must have Chrome installed
 * 2. You should be logged into GitHub in your normal Chrome browser
 * 3. Chrome must be closed before running this script (it will launch a custom instance)
 */

// Configuration
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const GUESTBOOK_URL = 'https://antonzhukov.github.io/guestbook/';
const COMMENT_TEXT = 'This is a test comment from the automation script. It works!';

// Chrome profile paths by OS
const CHROME_PROFILES = {
  win32: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
  linux: path.join(os.homedir(), '.config', 'google-chrome')
};

// Get correct path for current OS
const CHROME_PROFILE_PATH = CHROME_PROFILES[os.platform()];
const DEFAULT_PROFILE = path.join(CHROME_PROFILE_PATH, 'Default');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR);
}

// Check if Chrome profile exists
if (!fs.existsSync(CHROME_PROFILE_PATH)) {
  console.error(`Chrome profile not found at ${CHROME_PROFILE_PATH}`);
  console.error('Please make sure Chrome is installed on your system.');
  process.exit(1);
}

/**
 * Main execution function
 */
async function run() {
  console.log('Starting browser with your Chrome profile...');
  console.log(`Using Chrome profile from: ${CHROME_PROFILE_PATH}`);
  
  // Launch browser with user's Chrome profile
  let executablePath;
  
  // Determine Chrome executable path based on OS
  switch(os.platform()) {
    case 'win32':
      executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      // Alternative locations if standard path doesn't work
      if (!fs.existsSync(executablePath)) {
        executablePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
      }
      break;
    case 'darwin':
      executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      break;
    case 'linux':
      executablePath = '/usr/bin/google-chrome';
      break;
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  // Check if executable exists
  if (!fs.existsSync(executablePath)) {
    console.error(`Chrome executable not found at ${executablePath}`);
    console.error('Please install Chrome or correct the path in the script.');
    process.exit(1);
  }
  
  // Launch browser with persistent context using actual Chrome profile
  const browser = await chromium.launchPersistentContext(CHROME_PROFILE_PATH, {
    headless: false,
    executablePath: executablePath,
    args: [
      `--user-data-dir=${CHROME_PROFILE_PATH}`,
      '--no-default-browser-check',
      '--no-first-run',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1280, height: 800 }
  });
  
  // Use the default page context
  const page = await browser.newPage();
  
  // Apply additional anti-detection measures
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    
    // Advanced anti-detection
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' || 
      parameters.name === 'clipboard-read' || 
      parameters.name === 'clipboard-write' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    // Clean automation artifacts
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });
  
  try {
    // First check if we're already logged in to GitHub
    await page.goto('https://github.com', { waitUntil: 'networkidle' });
    
    // Take screenshot of GitHub state
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'github_state.png') });
    
    // Check if logged in by looking for profile indicators
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('.avatar, .header-nav-current-user, [aria-label*="profile"], .AppHeader-user');
    });
    
    if (!isLoggedIn) {
      console.log('Not logged in to GitHub! Please log in to Chrome normally before running this script.');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'not_logged_in.png') });
      await browser.close();
      return;
    }
    
    console.log('Successfully using authenticated GitHub session from your Chrome profile');
    
    // Go to the guestbook
    console.log('Navigating to guestbook...');
    await page.goto(GUESTBOOK_URL, { waitUntil: 'networkidle' });
    await naturalDelay();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'guestbook_home.png') });
    
    // Check if Sign in with GitHub button exists
    const signInButton = await page.$('a[href*="github"]');
    if (signInButton) {
      console.log('Found Sign in with GitHub button, clicking...');
      
      // Click with human-like behavior
      await humanClick(page, signInButton);
      
      // Wait for redirect and authorization
      console.log('Waiting for authorization process...');
      await naturalDelay(5000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'github_auth.png') });
      
      // Check if authorization page appears
      const authorizeButton = await page.$('button[type="submit"]:has-text("Authorize")');
      if (authorizeButton) {
        console.log('Authorization page detected, clicking authorize...');
        await humanClick(page, authorizeButton);
        await naturalDelay(5000);
      } else {
        console.log('No authorization page detected, already authorized');
      }
    } else {
      console.log('Already signed in to guestbook or sign-in button not found');
    }
    
    // Wait for guestbook to load
    await naturalDelay(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'guestbook_loaded.png') });
    
    // Fill out the comment form
    console.log('Looking for comment field...');
    await fillCommentForm(page);
    
  } catch (error) {
    console.error('Error during execution:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
  } finally {
    // Allow user to see the results before closing
    console.log('Task completed. Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
    // Close browser after execution or on error
    console.log('Closing browser...');
    await browser.close();
  }
}

/**
 * Fill out the comment form on the guestbook
 * @param {Page} page - Playwright page object
 */
async function fillCommentForm(page) {
  // Try multiple potential selectors for the comment field
  const commentSelectors = [
    'textarea[placeholder*="comment"]', 
    'textarea[name*="comment"]',
    'textarea#comment',
    'textarea.comment-input',
    'textarea',
    '[contenteditable="true"]'
  ];
  
  let commentField = null;
  
  for (const selector of commentSelectors) {
    const field = await page.$(selector);
    if (field) {
      const isVisible = await field.isVisible();
      if (isVisible) {
        commentField = field;
        console.log(`Found comment field using selector: ${selector}`);
        break;
      }
    }
  }
  
  if (commentField) {
    // Scroll to the comment field
    await commentField.scrollIntoViewIfNeeded();
    await naturalDelay();
    
    // Click the field with human-like motion
    await humanClick(page, commentField);
    
    // Type comment with human-like timing
    await humanType(page, COMMENT_TEXT);
    
    // Take screenshot of filled form
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'comment_filled.png') });
    
    // Look for submit button
    console.log('Looking for submit button...');
    
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]', 
      'button:has-text("Submit")',
      'button:has-text("Post")',
      'button:has-text("Comment")',
      'button.submit-btn',
      '.btn-primary'
    ];
    
    let submitButton = null;
    
    for (const selector of submitSelectors) {
      const buttons = await page.$$(selector);
      for (const button of buttons) {
        const isVisible = await button.isVisible();
        if (isVisible) {
          submitButton = button;
          console.log(`Found submit button using selector: ${selector}`);
          break;
        }
      }
      if (submitButton) break;
    }
    
    if (submitButton) {
      // Click the submit button
      console.log('Clicking submit button...');
      await humanClick(page, submitButton);
      
      // Wait for submission and take final screenshot
      await naturalDelay(3000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'comment_submitted.png') });
      
      console.log('Comment submitted successfully!');
    } else {
      console.error('Could not find submit button');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit_button_not_found.png') });
    }
  } else {
    console.error('Could not find comment field');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'comment_field_not_found.png') });
  }
}

/**
 * Human-like clicking behavior
 * @param {Page} page - Playwright page object
 * @param {ElementHandle} element - Element to click
 */
async function humanClick(page, element) {
  // Get element position
  const box = await element.boundingBox();
  
  if (box) {
    // Move mouse to a random starting position (if not already moving)
    if (Math.random() < 0.7) {
      const randomStartX = Math.floor(Math.random() * page.viewportSize().width);
      const randomStartY = Math.floor(Math.random() * page.viewportSize().height);
      
      await page.mouse.move(randomStartX, randomStartY, { steps: Math.floor(Math.random() * 5) + 3 });
      await naturalDelay(Math.floor(Math.random() * 300) + 200);
    }
    
    // Move to a random position near the element first
    const randomX = box.x - 40 + (Math.random() * 80);
    const randomY = box.y - 20 + (Math.random() * 40);
    
    await page.mouse.move(randomX, randomY, { steps: Math.floor(Math.random() * 10) + 5 });
    await naturalDelay(Math.floor(Math.random() * 300) + 150);
    
    // Move in a natural arc toward the element
    const controlPoints = generateNaturalCurvePoints(
      { x: randomX, y: randomY },
      { x: box.x + box.width/2, y: box.y + box.height/2 }
    );
    
    // Follow the curve
    for (let i = 1; i <= 10; i++) {
      const point = bezierCurve(i/10, controlPoints);
      await page.mouse.move(point.x, point.y);
      await naturalDelay(Math.floor(Math.random() * 40) + 20);
    }
    
    // Small delay before clicking
    await naturalDelay(Math.floor(Math.random() * 150) + 50);
    
    // Click with realistic mouse down/up timing
    await page.mouse.down();
    await naturalDelay(Math.floor(Math.random() * 100) + 30);
    await page.mouse.up();
  } else {
    // Fallback to regular click
    await element.click();
  }
  
  // Wait after clicking
  await naturalDelay(Math.floor(Math.random() * 500) + 200);
}

/**
 * Human-like typing behavior
 * @param {Page} page - Playwright page object
 * @param {string} text - Text to type
 */
async function humanType(page, text) {
  // Sometimes select all and delete before typing
  if (Math.random() < 0.3) {
    await page.keyboard.press('Control+A');
    await naturalDelay(Math.floor(Math.random() * 200) + 100);
    await page.keyboard.press('Backspace');
    await naturalDelay(Math.floor(Math.random() * 300) + 200);
  }
  
  // Create a realistic typing speed profile - humans type in bursts
  let typingBursts = [];
  let currentBurst = { startIndex: 0, speed: Math.random() * 70 + 80 }; // Base speed in ms
  
  // Split text into realistic "bursts" of typing
  for (let i = 1; i < text.length; i++) {
    // Change typing speed at natural breaks or randomly
    if (text[i] === ' ' || text[i] === '.' || text[i] === ',' || Math.random() < 0.1) {
      typingBursts.push({
        ...currentBurst,
        endIndex: i
      });
      currentBurst = { startIndex: i, speed: Math.random() * 70 + 80 };
    }
  }
  
  // Add the final burst
  typingBursts.push({
    ...currentBurst,
    endIndex: text.length - 1
  });
  
  // Now type according to the bursts
  for (const burst of typingBursts) {
    for (let i = burst.startIndex; i <= burst.endIndex; i++) {
      // Calculate delay for this character
      let delay = burst.speed;
      
      // Slow down for special characters
      if ("!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`".includes(text[i])) {
        delay += Math.random() * 100 + 50;
      }
      
      // Type the character
      await page.keyboard.type(text[i], { delay });
      
      // Very rarely make a typo and correct it
      if (Math.random() < 0.03 && i < text.length - 1) {
        // Make typo
        const wrongChar = String.fromCharCode(text.charCodeAt(i+1) + 1);
        await page.keyboard.type(wrongChar, { delay: Math.random() * 100 + 30 });
        await naturalDelay(Math.floor(Math.random() * 300) + 100);
        
        // Correct typo
        await page.keyboard.press('Backspace');
        await naturalDelay(Math.floor(Math.random() * 200) + 100);
      }
    }
    
    // Pause between bursts
    if (burst.endIndex < text.length - 1) {
      await naturalDelay(Math.floor(Math.random() * 500) + 200);
    }
  }
  
  // Sometimes pause at the end like thinking about what was typed
  if (Math.random() < 0.5) {
    await naturalDelay(Math.floor(Math.random() * 800) + 400);
  }
}

/**
 * Natural delay with randomization
 * @param {number} baseTime - Base time in ms
 * @returns {Promise} - Promise that resolves after the delay
 */
async function naturalDelay(baseTime = 1000) {
  const randomFactor = 0.2; // 20% randomization
  const actualTime = baseTime * (1 + (Math.random() * randomFactor * 2 - randomFactor));
  return new Promise(resolve => setTimeout(resolve, actualTime));
}

/**
 * Generate natural curve points for mouse movement
 * @param {Object} start - Start point {x, y}
 * @param {Object} end - End point {x, y}
 * @returns {Array} - Array of control points for bezier curve
 */
function generateNaturalCurvePoints(start, end) {
  const middleX = (start.x + end.x) / 2;
  const middleY = (start.y + end.y) / 2;
  
  // Add some randomness to the curve
  const controlPoint1 = {
    x: middleX + (Math.random() * 100 - 50),
    y: middleY + (Math.random() * 100 - 50)
  };
  
  const controlPoint2 = {
    x: middleX + (Math.random() * 100 - 50),
    y: middleY + (Math.random() * 100 - 50)
  };
  
  return [start, controlPoint1, controlPoint2, end];
}

/**
 * Calculate point on bezier curve
 * @param {number} t - Parameter between 0 and 1
 * @param {Array} points - Control points [p0, p1, p2, p3]
 * @returns {Object} - Point {x, y} on the curve
 */
function bezierCurve(t, points) {
  const [p0, p1, p2, p3] = points;
  
  // Cubic Bezier formula
  const x = Math.pow(1-t, 3) * p0.x + 
            3 * Math.pow(1-t, 2) * t * p1.x + 
            3 * (1-t) * Math.pow(t, 2) * p2.x + 
            Math.pow(t, 3) * p3.x;
            
  const y = Math.pow(1-t, 3) * p0.y + 
            3 * Math.pow(1-t, 2) * t * p1.y + 
            3 * (1-t) * Math.pow(t, 2) * p2.y + 
            Math.pow(t, 3) * p3.y;
            
  return { x, y };
}

// Run the script
run().catch(console.error);
