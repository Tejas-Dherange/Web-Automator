import playwright from 'playwright';
import fs from 'fs';

// This script focuses specifically on filling a comment on the guest book page
// after you've already logged in with GitHub

async function fillGuestbookComment() {
  console.log('Starting focused comment automation...');
  
  // Launch browser and set up
  const browser = await playwright.chromium.launch({ 
    headless: false,
    slowMo: 500 // Slowing down operations for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate directly to the guest book page
    console.log('Navigating to guest book page...');
    await page.goto('https://www.piyushgarg.dev/guest-book', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take screenshot to analyze the initial page
    console.log('Taking initial screenshot...');
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    fs.writeFileSync('initial_page.png', screenshotBuffer);
    
    // Check if we need to log in first (looking for GitHub login button)
    const needsLogin = await page.evaluate(() => {
      return document.body.textContent.includes('Sign in') || 
             document.body.textContent.includes('Login') ||
             document.body.textContent.includes('GitHub');
    });
    
    if (needsLogin) {
      console.log('Login required. Starting GitHub login process...');
      
      // Look for GitHub login button and click it
      try {
        // First try by text
        await page.click('text=Sign in with GitHub', { timeout: 5000 });
      } catch (e) {
        try {
          // Then try by common selectors
          await page.click('[aria-label="Sign in with GitHub"]', { timeout: 3000 });
        } catch (e2) {
          // Finally try by identifying GitHub-related elements
          const githubElements = await page.$$('button, a');
          for (const el of githubElements) {
            const text = await el.textContent();
            if (text.includes('GitHub')) {
              await el.click();
              break;
            }
          }
        }
      }
      
      console.log('Clicked GitHub login button, waiting for login page...');
      await page.waitForNavigation({ timeout: 10000 });
      
      // Take screenshot of login page
      await page.screenshot({ path: 'github_login.png' });
      console.log('On GitHub login page. Please manually complete login and 2FA if needed.');
      
      // Pausing for manual login
      console.log('Waiting 60 seconds for manual login completion...');
      await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds wait
    }
    
    console.log('Assuming we are now on the guest book page, looking for comment field...');
    await page.screenshot({ path: 'after_login.png' });
    
    // Wait a moment for page to fully load
    await page.waitForTimeout(3000);
    
    // Try multiple approaches to find and fill the comment field
    let commentFilled = false;
    
    // Approach 1: Try using textarea selector (most common for comment fields)
    try {
      console.log('Attempting to fill comment using textarea selector...');
      await page.fill('textarea', 'Hello, this comment was made using bot!');
      console.log('Successfully filled comment field using textarea selector');
      commentFilled = true;
    } catch (e) {
      console.log('Could not find textarea element:', e.message);
    }
    
    // Approach 2: Try common comment field selectors
    if (!commentFilled) {
      try {
        console.log('Attempting to fill comment using common comment selectors...');
        const commentSelectors = [
          '[placeholder="Write a comment..."]',
          '[placeholder="Add a comment..."]',
          '[placeholder="What\'s on your mind?"]',
          '[placeholder*="comment"]',
          '[placeholder*="message"]',
          '[name="comment"]',
          '.comment-input',
          '[role="textbox"]'
        ];
        
        for (const selector of commentSelectors) {
          try {
            await page.fill(selector, 'Hello, this comment was made using bot!');
            console.log(`Successfully filled comment field using selector: ${selector}`);
            commentFilled = true;
            break;
          } catch (error) {
            // Continue to next selector
          }
        }
      } catch (e) {
        console.log('Error with comment selectors approach:', e.message);
      }
    }
    
    // Approach 3: Try using JavaScript to identify and fill a likely comment field
    if (!commentFilled) {
      try {
        console.log('Using JavaScript to find and fill comment field...');
        commentFilled = await page.evaluate(() => {
          // Look for textareas first
          const textareas = Array.from(document.querySelectorAll('textarea'));
          if (textareas.length > 0) {
            textareas[0].value = 'Hello, this comment was made using bot!';
            textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          
          // Look for contenteditable elements
          const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
          if (editables.length > 0) {
            editables[0].textContent = 'Hello, this comment was made using bot!';
            editables[0].dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          
          // Look for input fields that might be for comments
          const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
          for (const input of inputs) {
            if (input.placeholder && 
                (input.placeholder.toLowerCase().includes('comment') || 
                 input.placeholder.toLowerCase().includes('message'))) {
              input.value = 'Hello, this comment was made using bot!';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
          }
          
          return false;
        });
        
        if (commentFilled) {
          console.log('Comment field filled using JavaScript evaluation');
        }
      } catch (e) {
        console.log('Error with JavaScript fill approach:', e.message);
      }
    }
    
    // Take screenshot after filling comment
    console.log('Taking screenshot after filling comment...');
    await page.screenshot({ path: 'filled_comment.png' });
    
    if (!commentFilled) {
      console.log('COULD NOT FILL COMMENT FIELD. Please check filled_comment.png for manual analysis.');
      return;
    }
    
    // Try to find and click the submit/send button
    console.log('Looking for submit/send button...');
    let buttonClicked = false;
    
    // Approach 1: Try by common button text
    try {
      const buttonTexts = ['Send', 'Submit', 'Post', 'Comment', 'Share', 'Publish'];
      for (const text of buttonTexts) {
        try {
          await page.click(`text=${text}`, { timeout: 3000 });
          console.log(`Clicked button with text: ${text}`);
          buttonClicked = true;
          break;
        } catch (e) {
          // Try next text
        }
      }
    } catch (e) {
      console.log('Could not click button by text:', e.message);
    }
    
    // Approach 2: Try by common button selectors
    if (!buttonClicked) {
      try {
        const buttonSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button.submit',
          'button.send',
          '.submit-button',
          '.send-button',
          '[aria-label="Submit"]',
          '[aria-label="Send"]'
        ];
        
        for (const selector of buttonSelectors) {
          try {
            await page.click(selector, { timeout: 3000 });
            console.log(`Clicked button with selector: ${selector}`);
            buttonClicked = true;
            break;
          } catch (e) {
            // Try next selector
          }
        }
      } catch (e) {
        console.log('Could not click button by selector:', e.message);
      }
    }
    
    // Approach 3: Try using JavaScript to find and click a likely submit button
    if (!buttonClicked) {
      try {
        buttonClicked = await page.evaluate(() => {
          // Look for buttons near our textarea/input
          const buttons = Array.from(document.querySelectorAll('button'));
          
          // First try buttons with submit/send text
          for (const button of buttons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('send') || text.includes('submit') || 
                text.includes('post') || text.includes('comment')) {
              button.click();
              return true;
            }
          }
          
          // Then try buttons that look like submit buttons
          for (const button of buttons) {
            if (button.type === 'submit' || 
                button.className.includes('submit') || 
                button.className.includes('send')) {
              button.click();
              return true;
            }
          }
          
          return false;
        });
        
        if (buttonClicked) {
          console.log('Submit button clicked using JavaScript evaluation');
        }
      } catch (e) {
        console.log('Error with JavaScript button click approach:', e.message);
      }
    }
    
    // Take final screenshot
    console.log('Taking final screenshot...');
    await page.waitForTimeout(3000); // Wait to see if comment appears
    await page.screenshot({ path: 'final_result.png' });
    
    if (!buttonClicked) {
      console.log('COULD NOT CLICK SUBMIT BUTTON. Please check filled_comment.png for manual analysis.');
    } else {
      console.log('Comment submission process completed. Check final_result.png to verify.');
    }
    
  } catch (error) {
    console.error('Automation failed:', error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log('\nAutomation script completed.');
    console.log('Browser will stay open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
  }
}

// Run the automation
fillGuestbookComment().catch(console.error);
