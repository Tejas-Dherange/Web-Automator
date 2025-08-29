import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Utility function to ensure screenshots directory exists
const ensureScreenshotDir = () => {
  const dir = './screenshots';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Main function for GitHub login
async function loginToGitHub() {
  console.log('Starting human-like GitHub login automation...');
  
  // Launch browser with persistent context to keep cookies and make it more like a real user's browser
  // This helps bypass security measures by using an actual user profile
  const userDataDir = path.join(process.cwd(), 'user-data-dir');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  
  console.log('Using persistent browser context to appear more like a regular user...');
  
  // Launch browser with slower actions to appear more human-like
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: 250, // Slightly slower actions
    args: [
      '--disable-blink-features=AutomationControlled', // Critical: prevent detection of automation
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--no-sandbox',
    ],
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    hasTouch: false,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    ignoreHTTPSErrors: true,
    acceptDownloads: true
  });
  
  // Add human-like behavior: Visit another page first
  const page = await context.newPage();
  
  console.log('First visiting the main page to establish a normal browsing pattern...');
  await page.goto('https://www.piyushgarg.dev', { 
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(2000);

  const screenshotDir = ensureScreenshotDir();
  
  // Take initial screenshot
  await page.screenshot({ path: path.join(screenshotDir, 'main_page.png') });
  console.log('Visited main page first');
  
  // Now navigate to guest book
  console.log('Now navigating to guest book page...');
  await page.goto('https://www.piyushgarg.dev/guest-book', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(2500);
  
  // Take a screenshot
  await page.screenshot({ path: path.join(screenshotDir, 'guest_book_page.png') });
  console.log('Guest book page loaded');
  
  // Look for GitHub signin button with more human-like behavior
  console.log('Looking for GitHub signin button...');
  
  // Move mouse around first like a human exploring the page
  await page.mouse.move(300, 200, { steps: 10 });
  await page.mouse.move(400, 300, { steps: 5 });
  await page.waitForTimeout(800);
  
  // Try to find the sign-in button
  try {
    // Find all buttons on the page to see what's available
    const buttons = await page.$$('button, a[role="button"], a.button, .btn');
    console.log(`Found ${buttons.length} possible button elements`);
    
    // Look for GitHub button specifically
    const githubButton = await page.locator('button, a', { 
      hasText: /GitHub|Sign In|Login/i 
    });
    
    if (await githubButton.count() > 0) {
      // Move mouse naturally toward the button
      const box = await githubButton.first().boundingBox();
      
      if (box) {
        // Approach the button gradually
        await page.mouse.move(box.x - 50, box.y - 20, { steps: 10 });
        await page.waitForTimeout(300);
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 5 });
        await page.waitForTimeout(500);
        
        // Click the button
        console.log('Clicking GitHub login button...');
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        console.log('Clicked GitHub login button');
      } else {
        console.log('Found GitHub button but could not get its position, trying direct click');
        await githubButton.first().click();
      }
    } else {
      console.log('Could not find GitHub button by text, trying generic signin');
      await page.click('a:has-text("Sign In"), button:has-text("Sign In")');
    }
  } catch (e) {
    console.log(`Error finding GitHub button: ${e.message}`);
    await page.screenshot({ path: path.join(screenshotDir, 'github_button_error.png') });
    
    // Try a less specific approach
    try {
      console.log('Trying to find any login-related button...');
      await page.click('a, button', { timeout: 5000 });
    } catch (e2) {
      console.log(`Could not find any clickable login elements: ${e2.message}`);
    }
  }
  
  // Wait for GitHub login page to appear
  console.log('Waiting for GitHub login page...');
  
  try {
    // Wait for navigation or GitHub form to appear with a longer timeout
    await Promise.race([
      page.waitForNavigation({ timeout: 15000 }),
      page.waitForSelector('input[name="login"], #login_field', { timeout: 15000 })
    ]);
    
    // Take screenshot of GitHub login page
    await page.screenshot({ path: path.join(screenshotDir, 'github_login_page.png') });
    console.log('GitHub login page detected');
    
    // Modify navigator properties to make automation detection harder
    await page.evaluate(() => {
      // Overwrite the navigator properties that automation detection looks for
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Add fake plugins to look more like a real browser
      if (!navigator.plugins || navigator.plugins.length === 0) {
        Object.defineProperty(navigator, 'plugins', { 
          get: () => [1, 2, 3, 4, 5].map(() => ({ name: 'Plugin' }))
        });
      }
      
      // Add languages
      Object.defineProperty(navigator, 'languages', { 
        get: () => ['en-US', 'en']
      });
    });
    
    // Look around the page like a human would - random mouse movements
    for (let i = 0; i < 3; i++) {
      const randomX = Math.floor(Math.random() * 800) + 100;
      const randomY = Math.floor(Math.random() * 400) + 100;
      await page.mouse.move(randomX, randomY, { steps: Math.floor(Math.random() * 10) + 5 });
      await page.waitForTimeout(Math.floor(Math.random() * 500) + 200);
    }
    
    // Wait a moment before interacting with the page - more realistic timing
    await page.waitForTimeout(Math.floor(Math.random() * 1000) + 1500);
    
    // Find username field with multiple fallback selectors
    const usernameSelectors = [
      'input[name="login"]',
      '#login_field', 
      'input[type="text"]', 
      'input[type="email"]'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      const field = await page.$(selector);
      if (field) {
        usernameField = field;
        console.log(`Found username field using selector: ${selector}`);
        break;
      }
    }
    
    if (usernameField) {
      // Scroll into view if needed (more human-like)
      await usernameField.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Get position
      const userBox = await usernameField.boundingBox();
      
      if (userBox) {
        // Move mouse around near the field first (like a human considering what to do)
        const randomOffsetX = Math.floor(Math.random() * 100) - 50;
        const randomOffsetY = Math.floor(Math.random() * 60) - 30;
        await page.mouse.move(
          userBox.x + userBox.width/2 + randomOffsetX,
          userBox.y + userBox.height/2 + randomOffsetY,
          { steps: 10 }
        );
        await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
        
        // Now move to the field in a curved, human-like motion
        await page.mouse.move(userBox.x - 30, userBox.y - 15, { steps: 8 });
        await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
        await page.mouse.move(userBox.x + userBox.width/2, userBox.y + userBox.height/2, { steps: 6 });
        await page.waitForTimeout(Math.floor(Math.random() * 300) + 100);
        
        // Click field
        await page.mouse.click(userBox.x + userBox.width/2, userBox.y + userBox.height/2);
        
        // Clear field with keyboard commands
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
        
        // Type username with very human-like timing
        console.log('Typing username...');
        const username = '';
        
        // Type with realistic human patterns - occasional mistakes and corrections
        for (let i = 0; i < username.length; i++) {
          // Randomly make a typo ~5% of the time for realism
          const makeTypo = Math.random() < 0.05 && i > 3;
          
          if (makeTypo) {
            // Make a typo
            const typoChar = String.fromCharCode(username.charCodeAt(i) + 1);
            await page.keyboard.type(typoChar, { delay: Math.random() * 120 + 50 });
            await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
            
            // Correct the typo
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
            await page.keyboard.type(username[i], { delay: Math.random() * 100 + 70 });
          } else {
            // Normal typing with variable speed
            const delay = Math.random() * 150 + 30;
            await page.keyboard.type(username[i], { delay });
            
            // Occasionally pause like a human thinking or distracted
            if (Math.random() < 0.1 && i > 5) {
              await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
            }
          }
        }
        
        // Wait before moving to password field - natural pause after username
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 800);
        
        // Find password field with multiple fallback selectors
        const passwordSelectors = [
          'input[name="password"]', 
          '#password', 
          'input[type="password"]'
        ];
        
        let passwordField = null;
        for (const selector of passwordSelectors) {
          const field = await page.$(selector);
          if (field) {
            passwordField = field;
            console.log(`Found password field using selector: ${selector}`);
            break;
          }
        }
        
        if (!passwordField) {
          // Fall back to locator method if direct selectors didn't work
          passwordField = page.locator('input[name="password"], #password').first();
        }
        
        if (await passwordField?.count?.() > 0 || passwordField) {
          // Move to password field using one of multiple human-like approaches
          const approachType = Math.random();
          
          if (approachType < 0.4) {
            // Use tab like a human might
            console.log('Using tab key to move to password field');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
            
            // Sometimes press tab twice like a confused human
            if (Math.random() < 0.2) {
              await page.keyboard.press('Tab');
              await page.waitForTimeout(200);
              await page.keyboard.press('ShiftLeft+Tab'); // Go back
              await page.waitForTimeout(300);
            }
          } else {
            // Use mouse with natural motion
            console.log('Using mouse to move to password field');
            const passBox = await passwordField.boundingBox();
            
            if (passBox) {
              // Create a natural mouse movement path with slight curve
              // First move to a random position near the field
              const randomX = passBox.x + passBox.width/2 + (Math.random() * 80 - 40);
              const randomY = passBox.y - 20 + (Math.random() * 15);
              
              await page.mouse.move(randomX, randomY, { steps: Math.floor(Math.random() * 8) + 4 });
              await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
              
              // Then move to the actual field in a natural arc
              await page.mouse.move(passBox.x + passBox.width/2, passBox.y + passBox.height/2, { steps: Math.floor(Math.random() * 5) + 3 });
              await page.waitForTimeout(Math.floor(Math.random() * 300) + 150);
              
              // Click with slight randomization to position
              const offsetX = (Math.random() * 10) - 5;
              const offsetY = (Math.random() * 6) - 3;
              await page.mouse.click(
                passBox.x + passBox.width/2 + offsetX, 
                passBox.y + passBox.height/2 + offsetY
              );
            } else {
              // Fall back to direct click if we can't get bounding box
              await passwordField.click();
            }
          }
          
          // Clear field in case there's any text (happens sometimes with autofill)
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(Math.floor(Math.random() * 200) + 100);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
          
          // Type password with very human-like timing
          console.log('Typing password...');
          const password = '';
          
          // Variable typing speed for password with pauses
          for (let i = 0; i < password.length; i++) {
            // More variation in typing speed for password (security conscious behavior)
            let delay = Math.random() * 180 + 40;
            
            // Slow down for special characters (very human-like)
            if ("!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`".includes(password[i])) {
              delay += Math.random() * 200 + 100;
            }
            
            // Type character
            await page.keyboard.type(password[i], { delay });
            
            // Occasionally pause during password typing (very human-like)
            if (Math.random() < 0.15) {
              await page.waitForTimeout(Math.floor(Math.random() * 600) + 400);
            }
          }
          
          // Take screenshot before clicking sign in (with password hidden)
          await page.evaluate(() => {
            const pwField = document.querySelector('input[name="password"], #password');
            if (pwField) {
              pwField.type = 'text';
              pwField.value = '[PASSWORD ENTERED]';
            }
          });
          await page.screenshot({ path: path.join(screenshotDir, 'credentials_entered.png') });
          
          // Restore password field
          await page.evaluate(() => {
            const pwField = document.querySelector('input[name="password"], #password');
            if (pwField) pwField.type = 'password';
          });
          
          // Wait a moment before clicking sign in (like a human verifying their input)
          await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1200);
          
          // Maybe move mouse away from fields first (like a human)
          if (Math.random() > 0.5) {
            await page.mouse.move(
              Math.floor(Math.random() * 300) + 200, 
              Math.floor(Math.random() * 200) + 100,
              { steps: Math.floor(Math.random() * 5) + 3 }
            );
            await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
          }
          
          // Find sign in button with multiple selectors for better reliability
          const signInSelectors = [
            'input[type="submit"]', 
            'button[type="submit"]', 
            '[name="commit"]',
            'button:has-text("Sign in")',
            'button:has-text("Log in")',
            'input[value="Sign in"]',
            'input[value="Log in"]'
          ];
          
          // Try each selector until we find one that works
          let signInButton = null;
          let signInButtonSelector = '';
          
          for (const selector of signInSelectors) {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              // Filter visible elements
              for (const el of elements) {
                const isVisible = await el.isVisible();
                if (isVisible) {
                  signInButton = el;
                  signInButtonSelector = selector;
                  console.log(`Found sign in button with selector: ${selector}`);
                  break;
                }
              }
              if (signInButton) break;
            }
          }
          
          // If we found a button
          if (signInButton) {
            // Make sure it's visible
            await signInButton.scrollIntoViewIfNeeded();
            await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
            
            // Move mouse to button with human-like motion
            const btnBox = await signInButton.boundingBox();
            if (btnBox) {
              // Start from a random position on screen
              const startX = Math.floor(Math.random() * 500) + 100;
              const startY = Math.floor(Math.random() * 300) + 100;
              
              // Move to this random position first
              await page.mouse.move(startX, startY, { steps: Math.floor(Math.random() * 5) + 3 });
              await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
              
              // Move toward button gradually with a natural arc
              const midX = btnBox.x - 40 + Math.random() * 80;
              const midY = btnBox.y - 30 + Math.random() * 20;
              await page.mouse.move(midX, midY, { steps: Math.floor(Math.random() * 8) + 5 });
              await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
              
              // Final approach to button
              await page.mouse.move(btnBox.x + btnBox.width/2, btnBox.y + btnBox.height/2, { steps: Math.floor(Math.random() * 6) + 3 });
              await page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
              
              // Show human hesitation sometimes
              if (Math.random() < 0.3) {
                // Move away slightly and back (hesitation)
                await page.mouse.move(
                  btnBox.x + btnBox.width/2 + 15, 
                  btnBox.y + btnBox.height/2 - 10, 
                  { steps: 3 }
                );
                await page.waitForTimeout(Math.floor(Math.random() * 600) + 400);
                await page.mouse.move(
                  btnBox.x + btnBox.width/2, 
                  btnBox.y + btnBox.height/2, 
                  { steps: 3 }
                );
                await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
              }
              
              // Click with slight offset like a human
              const offsetX = (Math.random() * 10) - 5;
              const offsetY = (Math.random() * 6) - 3;
              console.log('Clicking sign in button...');
              
              // Click with realistic mouse down/up timing
              await page.mouse.move(
                btnBox.x + btnBox.width/2 + offsetX, 
                btnBox.y + btnBox.height/2 + offsetY,
                { steps: 2 }
              );
              await page.mouse.down();
              await page.waitForTimeout(Math.floor(Math.random() * 150) + 80);
              await page.mouse.up();
            } else {
              console.log('Clicking sign in button directly...');
              await signInButton.click({ delay: Math.floor(Math.random() * 100) + 30 });
            }
            console.log('Clicked sign in button');
          } else {
            console.log('Could not find sign in button with standard selectors, trying generic approach');
            try {
              // Try to find anything clickable that might be a login button
              for (const text of ['Sign in', 'Log in', 'Login', 'Continue', 'Submit']) {
                const elements = await page.$$(`text="${text}"`);
                if (elements.length > 0) {
                  console.log(`Found possible login element with text: ${text}`);
                  await elements[0].click({ delay: Math.floor(Math.random() * 100) + 30 });
                  break;
                }
              }
            } catch (err) {
              console.error('Error trying to find login button:', err);
              await page.screenshot({ path: path.join(screenshotDir, 'login_button_error.png') });
            }
          }
          
          // Wait for navigation or potential CAPTCHA/2FA with a longer timeout
          console.log('Waiting for login process to complete...');
          
          // Take a screenshot after a short delay
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(screenshotDir, 'initial_login_response.png') });
          
          // Wait longer to see full navigation result
          await page.waitForTimeout(8000);
          await page.screenshot({ path: path.join(screenshotDir, 'post_login.png') });
          
          // Check for errors or security challenges using more comprehensive methods
          const pageContent = await page.content();
          const pageUrl = page.url();
          const pageTitle = await page.title();
          
          // Extract text content for better error detection
          const textContent = await page.evaluate(() => document.body.innerText);
          
          // Get any visible error messages using multiple methods
          const errorMessages = await page.evaluate(() => {
            const results = [];
            // Look for error messages in common elements
            const errorElements = [
              ...document.querySelectorAll('.error, .alert, .flash-error, .message-error, [role="alert"]'),
              ...Array.from(document.querySelectorAll('p, div, span')).filter(el => {
                const text = el.innerText.toLowerCase();
                return text.includes('error') || 
                       text.includes('incorrect') || 
                       text.includes('failed') ||
                       text.includes('wrong') ||
                       text.includes('invalid');
              })
            ];
            
            errorElements.forEach(el => {
              if (el.innerText.trim()) results.push(el.innerText.trim());
            });
            
            return results;
          });
          
          // Log all diagnostic information
          console.log('Current URL:', pageUrl);
          console.log('Page title:', pageTitle);
          if (errorMessages.length > 0) {
            console.log('Detected error messages:', errorMessages);
          }
          
          // Define extensive patterns for error/challenge detection
          const isLoginError = 
            pageContent.includes('Incorrect username or password') || 
            pageContent.includes('Authentication failed') ||
            pageContent.includes('rate limit') ||
            pageContent.includes('try again') ||
            pageContent.includes('invalid password') ||
            pageContent.includes('invalid username') ||
            pageContent.includes('login failed') ||
            errorMessages.some(msg => 
              msg.toLowerCase().includes('incorrect') ||
              msg.toLowerCase().includes('failed') ||
              msg.toLowerCase().includes('invalid') ||
              msg.toLowerCase().includes('wrong')
            );
          
          const isCaptcha = 
            pageContent.toLowerCase().includes('captcha') ||
            pageContent.toLowerCase().includes('robot') ||
            pageContent.toLowerCase().includes('human verification') ||
            pageContent.toLowerCase().includes('prove you') ||
            pageContent.toLowerCase().includes('verify you') ||
            pageContent.includes('security check') ||
            pageContent.includes('check if you') ||
            // Check for recaptcha elements
            await page.$$eval('iframe[src*="recaptcha"], div.g-recaptcha, .h-captcha', elements => elements.length > 0);
          
          const isTwoFactor = 
            pageContent.toLowerCase().includes('two-factor') || 
            pageContent.toLowerCase().includes('2fa') || 
            pageContent.toLowerCase().includes('verification') ||
            pageContent.toLowerCase().includes('verify your') ||
            pageContent.toLowerCase().includes('authentication code') ||
            pageContent.toLowerCase().includes('security code') ||
            pageContent.toLowerCase().includes('one-time code') ||
            pageContent.toLowerCase().includes('device confirmation') ||
            pageTitle.toLowerCase().includes('verification');
          
          const isBlocked =
            pageContent.toLowerCase().includes('suspicious') ||
            pageContent.toLowerCase().includes('unusual activity') ||
            pageContent.toLowerCase().includes('blocked') ||
            pageContent.toLowerCase().includes('security alert') ||
            pageContent.toLowerCase().includes('login attempt') ||
            textContent.toLowerCase().includes('automated');
          
          // Handle different cases with specialized responses
          if (isLoginError) {
            console.log('ERROR: Login failed - incorrect credentials or rate limiting');
            await page.screenshot({ path: path.join(screenshotDir, 'login_error.png') });
            
            // Log the exact error for debugging
            if (errorMessages.length > 0) {
              console.log('Error details:', errorMessages.join(' | '));
            }
            
            // Check for rate limiting specifically
            if (pageContent.toLowerCase().includes('rate limit') || 
                pageContent.toLowerCase().includes('too many') ||
                textContent.toLowerCase().includes('try again later')) {
              console.log('RATE LIMITING DETECTED: GitHub is limiting login attempts. Wait before trying again.');
            }
          } else if (isCaptcha) {
            console.log('CAPTCHA detected! Please solve it manually in the browser');
            await page.screenshot({ path: path.join(screenshotDir, 'captcha_challenge.png') });
            
            // Attempt to detect captcha type
            const captchaType = await page.evaluate(() => {
              if (document.querySelector('iframe[src*="recaptcha"]')) return 'reCAPTCHA';
              if (document.querySelector('.h-captcha')) return 'hCaptcha';
              if (document.querySelector('#captcha-image, img[alt*="captcha"]')) return 'Image CAPTCHA';
              return 'Unknown CAPTCHA';
            });
            
            console.log(`CAPTCHA type: ${captchaType}`);
            console.log('Waiting for manual CAPTCHA solving...');
            
            // Wait for manual CAPTCHA solving with a longer timeout
            await page.waitForTimeout(45000);
          } else if (isBlocked) {
            console.log('ACCOUNT SECURITY ALERT: GitHub has detected automated access and blocked the login attempt');
            await page.screenshot({ path: path.join(screenshotDir, 'account_blocked.png') });
            console.log('You may need to verify your account through email or login manually first');
            
            // Try to extract more information about the block
            const blockMessages = await page.evaluate(() => {
              const elements = document.querySelectorAll('p, div.flash, .text-center, .flash-error, [role="alert"]');
              return Array.from(elements).map(el => el.innerText).filter(Boolean);
            });
            
            if (blockMessages.length > 0) {
              console.log('Block details:', blockMessages.join(' | '));
            }
          } else if (isTwoFactor) {
            console.log('Two-factor authentication required! Please complete it manually');
            await page.screenshot({ path: path.join(screenshotDir, 'two_factor.png') });
            // Wait for manual 2FA completion
            await page.waitForTimeout(30000);
          }
          
          // Check for authorization request
          if (pageContent.includes('Authorize') || pageContent.includes('authorization')) {
            console.log('Authorization page detected, clicking authorize button...');
            try {
              await page.click('button:has-text("Authorize"), input[value="Authorize"]');
              console.log('Clicked authorize button');
            } catch (authError) {
              console.log(`Error clicking authorize button: ${authError.message}`);
              await page.screenshot({ path: path.join(screenshotDir, 'authorize_error.png') });
            }
          }
          
          // Wait for return to guest book page
          console.log('Waiting to return to guest book page...');
          await page.waitForTimeout(5000);
          
          // Check current URL
          const currentUrl = page.url();
          console.log(`Current URL: ${currentUrl}`);
          
          // Take screenshot of current page
          await page.screenshot({ path: path.join(screenshotDir, 'current_page.png') });
          
          // Check if login was successful
          if (currentUrl.includes('piyushgarg.dev')) {
            console.log('Successfully returned to guest book page');
            
            // Fill comment field
            console.log('Looking for comment field...');
            await page.waitForTimeout(3000);
            
            try {
              // Look for textarea first
              await page.waitForSelector('textarea', { timeout: 5000 });
              console.log('Found textarea for comment');
              
              // Type comment with human-like behavior
              await page.click('textarea');
              await page.waitForTimeout(800);
              
              const comment = 'Hello, this comment was made using an enhanced automation bot!';
              for (let i = 0; i < comment.length; i++) {
                await page.keyboard.type(comment[i], { delay: Math.random() * 80 + 30 });
                // Add occasional longer pauses like a human
                if (i % 15 === 0 && i > 0) {
                  await page.waitForTimeout(Math.random() * 300 + 100);
                }
              }
              
              console.log('Comment entered');
              await page.screenshot({ path: path.join(screenshotDir, 'comment_entered.png') });
              
              // Look for submit button
              console.log('Looking for submit button...');
              await page.waitForTimeout(1000);
              
              try {
                // Try to find a submit button near the textarea
                await page.click('textarea ~ button, textarea + button, button:has-text("Submit"), button:has-text("Send"), button:has-text("Post")');
                console.log('Clicked submit button');
              } catch (submitError) {
                console.log(`Error finding submit button: ${submitError.message}`);
                await page.screenshot({ path: path.join(screenshotDir, 'submit_error.png') });
              }
              
              // Wait for submission to complete
              await page.waitForTimeout(5000);
              await page.screenshot({ path: path.join(screenshotDir, 'final_result.png') });
              
            } catch (commentError) {
              console.log(`Error with comment field: ${commentError.message}`);
              await page.screenshot({ path: path.join(screenshotDir, 'comment_error.png') });
            }
          } else {
            console.log('Did not return to guest book page, current URL:', currentUrl);
          }
        } else {
          console.log('Could not find password field');
          await page.screenshot({ path: path.join(screenshotDir, 'no_password_field.png') });
        }
      } else {
        console.log('Could not find username field');
        await page.screenshot({ path: path.join(screenshotDir, 'no_username_field.png') });
      }
    }
  } catch (navError) {
    console.log(`Error during navigation to GitHub: ${navError.message}`);
    await page.screenshot({ path: path.join(screenshotDir, 'navigation_error.png') });
  }
  
  // Keep the browser open for inspection
  console.log('Automation completed. Browser will remain open for 2 minutes for inspection');
  console.log('Check the screenshots folder for visual results');
  
  // Wait before closing
  await page.waitForTimeout(120000);
  
  // Close browser
  await browser.close();
}

// Run the automation
(async () => {
  try {
    await loginToGitHub();
  } catch (error) {
    console.error('Automation failed:', error);
  }
})();
