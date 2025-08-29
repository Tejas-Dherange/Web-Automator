const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Pre-authenticated Browser Session Approach
 * 
 * This script uses a persistent browser context to maintain login sessions.
 * Steps to use:
 * 1. First run this script with MANUAL_LOGIN=true
 * 2. Log in manually when the browser opens
 * 3. Once logged in, close the browser 
 * 4. Run again with MANUAL_LOGIN=false to use the saved authenticated session
 * 
 * This bypasses many anti-bot measures as the initial authentication is done manually
 * and the script just reuses those authentication cookies/tokens.
 */

// Configuration
const MANUAL_LOGIN = process.env.MANUAL_LOGIN === 'true' || false; // Set to true for initial login
const USER_DATA_DIR = path.join(__dirname, 'browser_profile');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const GITHUB_URL = 'https://github.com/login';
const GUESTBOOK_URL = 'https://antonzhukov.github.io/guestbook/';
const COMMENT_TEXT = 'This is a test comment from the automation script. It works!';

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR);
}

// Ensure user data directory exists
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR);
}

/**
 * Main execution function
 */
async function run() {
  console.log('Starting browser with persistent context...');
  console.log(`Profile directory: ${USER_DATA_DIR}`);
  
  // Launch browser with persistent context - this maintains cookies, storage, etc.
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // Always use headed mode for this approach
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'], 
    ignoreHTTPSErrors: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-data-dir=' + USER_DATA_DIR,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
  
  // Use the default page context
  const page = await browser.newPage();
  
  // Set extra headers to appear more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1'
  });
  
  // Override automation-detection properties in JavaScript
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5].map(() => ({ name: 'Plugin' })) });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    
    // Override other detection methods
    if (window.navigator.permissions) {
      window.navigator.permissions.query = (parameters) => {
        return Promise.resolve({ state: 'granted' });
      };
    }
    
    // Hide automation features
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });
  
  try {
    // In manual login mode, just go to GitHub and wait for user to log in
    if (MANUAL_LOGIN) {
      console.log('MANUAL LOGIN MODE: Please log in when the browser opens');
      await page.goto(GITHUB_URL);
      console.log('Waiting for manual login...');
      
      // Wait for user to login (look for profile indicator or avatar)
      try {
        // Wait up to 3 minutes for manual login
        await page.waitForSelector('.avatar, .header-nav-current-user, [aria-label*="profile"]', { timeout: 180000 });
        console.log('Login detected! Profile session saved.');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'manual_login_complete.png') });
      } catch (err) {
        console.log('Login timeout or error. You may need to try again.');
      }
      
      // Keep browser open for a minute to ensure all cookies/storage are saved
      await page.waitForTimeout(10000);
      console.log('Browser profile saved! You can now run the script with MANUAL_LOGIN=false');
    } 
    // In automated mode, use saved session to access guestbook
    else {
      console.log('Using saved browser profile to access guestbook...');
      
      // First check if we're already logged in to GitHub
      await page.goto('https://github.com');
      
      // Take screenshot of GitHub state
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'github_state.png') });
      
      // Check if logged in by looking for profile indicators
      const isLoggedIn = await page.evaluate(() => {
        return !!document.querySelector('.avatar, .header-nav-current-user, [aria-label*="profile"], .AppHeader-user');
      });
      
      if (!isLoggedIn) {
        console.log('Not logged in to GitHub! Please run with MANUAL_LOGIN=true first');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'not_logged_in.png') });
        await browser.close();
        return;
      }
      
      console.log('Successfully using authenticated GitHub session');
      
      // Now go to the guestbook
      console.log('Navigating to guestbook...');
      await page.goto(GUESTBOOK_URL);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'guestbook_home.png') });
      
      // Check if Sign in with GitHub button exists
      const signInButton = await page.$('a[href*="github"]');
      if (signInButton) {
        console.log('Found Sign in with GitHub button, clicking...');
        
        // Click with human-like behavior
        await humanClick(page, signInButton);
        
        // Wait for redirect and authorization
        console.log('Waiting for authorization process...');
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'github_auth.png') });
        
        // Check if authorization page appears
        const authorizeButton = await page.$('button[type="submit"]:has-text("Authorize")');
        if (authorizeButton) {
          console.log('Authorization page detected, clicking authorize...');
          await humanClick(page, authorizeButton);
          await page.waitForTimeout(5000);
        } else {
          console.log('No authorization page detected, already authorized');
        }
      } else {
        console.log('Already signed in to guestbook or sign-in button not found');
      }
      
      // Wait for guestbook to load
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'guestbook_loaded.png') });
      
      // Fill out the comment form
      console.log('Looking for comment field...');
      
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
        await page.waitForTimeout(1000);
        
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
          await page.waitForTimeout(3000);
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
  } catch (error) {
    console.error('Error during execution:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
  } finally {
    // Close browser after execution or on error
    console.log('Closing browser...');
    await browser.close();
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
    // Move to a random position near the element first
    const randomX = box.x - 50 + (Math.random() * 100);
    const randomY = box.y - 30 + (Math.random() * 60);
    
    await page.mouse.move(randomX, randomY, { steps: Math.floor(Math.random() * 10) + 5 });
    await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
    
    // Now move to the element with a curved motion
    await page.mouse.move(
      box.x + box.width * (0.3 + Math.random() * 0.4), 
      box.y + box.height * (0.3 + Math.random() * 0.4), 
      { steps: Math.floor(Math.random() * 8) + 6 }
    );
    
    // Small delay before clicking
    await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
    
    // Click with realistic mouse down/up timing
    await page.mouse.down();
    await page.waitForTimeout(Math.floor(Math.random() * 120) + 50);
    await page.mouse.up();
  } else {
    // Fallback to regular click
    await element.click();
  }
  
  // Wait after clicking
  await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
}

/**
 * Human-like typing behavior
 * @param {Page} page - Playwright page object
 * @param {string} text - Text to type
 */
async function humanType(page, text) {
  for (let i = 0; i < text.length; i++) {
    // Variable typing speed
    const delay = Math.random() * 150 + 30;
    
    await page.keyboard.type(text[i], { delay });
    
    // Occasionally pause like a human thinking
    if (Math.random() < 0.1 && i > 0) {
      await page.waitForTimeout(Math.floor(Math.random() * 600) + 300);
    }
    
    // Very rarely make a typo and correct it
    if (Math.random() < 0.02 && i < text.length - 1) {
      // Make typo
      const wrongChar = String.fromCharCode(text.charCodeAt(i+1) + 1);
      await page.keyboard.type(wrongChar, { delay: Math.random() * 100 + 30 });
      await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
      
      // Correct typo
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
    }
  }
}

// Run the script
run().catch(console.error);
