import playwright from 'playwright';
import fs from 'fs';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promise wrapper for readline question
const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function interactiveGuestbookComment() {
  console.log('\n=== INTERACTIVE GUESTBOOK COMMENT TOOL ===');
  console.log('This script will help you fill the comment field step by step');
  
  // Launch browser and set up
  console.log('\nLaunching browser...');
  const browser = await playwright.chromium.launch({ 
    headless: false,
    slowMo: 100
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
    await page.screenshot({ path: 'initial_page.png' });
    console.log('Screenshot saved as initial_page.png');
    
    // Wait for user to confirm login
    await question('\nPress Enter after you have manually logged in with GitHub (if needed)...');
    
    // Take screenshot after login
    console.log('\nTaking screenshot after login...');
    await page.screenshot({ path: 'after_login.png' });
    console.log('Screenshot saved as after_login.png');
    
    // Generate report on interactive elements
    console.log('\nAnalyzing page for interactive elements...');
    
    const elements = await page.evaluate(() => {
      // Find all potential interactive elements
      const allElements = Array.from(document.querySelectorAll('button, a, input, textarea, [contenteditable="true"], [role="textbox"]'));
      
      return allElements
        .filter(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && 
                 style.display !== 'none' && 
                 style.visibility !== 'hidden';
        })
        .map(el => {
          const rect = el.getBoundingClientRect();
          
          return {
            tagName: el.tagName.toLowerCase(),
            id: el.id || 'none',
            className: (typeof el.className === 'string' ? el.className : el.className.toString()) || 'none',
            type: el.type || 'none',
            placeholder: el.placeholder || 'none',
            textContent: el.textContent?.trim().substring(0, 30) || 'none',
            coordinates: {
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2)
            }
          };
        });
    });
    
    // Display interactive elements
    console.log('\n=== INTERACTIVE ELEMENTS ===');
    elements.forEach((el, index) => {
      console.log(`\nElement ${index + 1}:`);
      console.log(`  Type: ${el.tagName}`);
      console.log(`  Text: ${el.textContent}`);
      console.log(`  ID: ${el.id}`);
      console.log(`  Class: ${el.className}`);
      if (el.placeholder !== 'none') console.log(`  Placeholder: ${el.placeholder}`);
      console.log(`  Coordinates: (${el.coordinates.x}, ${el.coordinates.y})`);
    });
    
    // Find potential comment fields
    const potentialCommentFields = elements.filter(el => 
      el.tagName === 'textarea' || 
      el.placeholder.toLowerCase().includes('comment') ||
      el.placeholder.toLowerCase().includes('message') ||
      el.placeholder.toLowerCase().includes('write') ||
      (el.className.toLowerCase().includes('comment') && 
       (el.tagName === 'input' || el.tagName === 'div' || el.tagName === 'textarea'))
    );
    
    // Find potential submit buttons
    const potentialSubmitButtons = elements.filter(el => 
      (el.tagName === 'button' || el.tagName === 'input' || el.tagName === 'a') && 
      (el.textContent.toLowerCase().includes('send') ||
       el.textContent.toLowerCase().includes('submit') ||
       el.textContent.toLowerCase().includes('post') ||
       el.textContent.toLowerCase().includes('comment') ||
       el.className.toLowerCase().includes('submit') ||
       el.className.toLowerCase().includes('send'))
    );
    
    // Show recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    
    if (potentialCommentFields.length > 0) {
      console.log('\nPotential comment fields:');
      potentialCommentFields.forEach((el, index) => {
        console.log(`${index + 1}. ${el.tagName} at (${el.coordinates.x}, ${el.coordinates.y}) - ${el.placeholder !== 'none' ? `Placeholder: ${el.placeholder}` : `Text: ${el.textContent}`}`);
      });
    } else {
      console.log('\nNo obvious comment fields detected.');
    }
    
    if (potentialSubmitButtons.length > 0) {
      console.log('\nPotential submit buttons:');
      potentialSubmitButtons.forEach((el, index) => {
        console.log(`${index + 1}. ${el.tagName} at (${el.coordinates.x}, ${el.coordinates.y}) - Text: ${el.textContent}`);
      });
    } else {
      console.log('\nNo obvious submit buttons detected.');
    }
    
    // Let user select comment field
    let commentFieldSelection;
    if (potentialCommentFields.length > 0) {
      commentFieldSelection = await question('\nEnter the number of the comment field to use (or enter coordinates x,y): ');
    } else {
      commentFieldSelection = await question('\nEnter coordinates for comment field (x,y): ');
    }
    
    // Process comment field selection
    let commentX, commentY;
    
    if (commentFieldSelection.includes(',')) {
      // User provided coordinates
      [commentX, commentY] = commentFieldSelection.split(',').map(n => parseInt(n.trim()));
    } else {
      // User provided index
      const index = parseInt(commentFieldSelection) - 1;
      if (potentialCommentFields[index]) {
        commentX = potentialCommentFields[index].coordinates.x;
        commentY = potentialCommentFields[index].coordinates.y;
      } else {
        console.log('Invalid selection. Please try again.');
        await browser.close();
        rl.close();
        return;
      }
    }
    
    // Click the comment field
    console.log(`\nClicking at position (${commentX}, ${commentY})...`);
    await page.mouse.click(commentX, commentY);
    await page.waitForTimeout(1000);
    
    // Type the comment
    console.log('Typing comment: "Hello, this comment was made using bot!"');
    await page.keyboard.type('Hello, this comment was made using bot!');
    
    // Take screenshot after filling comment
    await page.screenshot({ path: 'filled_comment.png' });
    console.log('Screenshot saved as filled_comment.png');
    
    // Let user select submit button
    let submitButtonSelection;
    if (potentialSubmitButtons.length > 0) {
      submitButtonSelection = await question('\nEnter the number of the submit button to use (or enter coordinates x,y): ');
    } else {
      submitButtonSelection = await question('\nEnter coordinates for submit button (x,y): ');
    }
    
    // Process submit button selection
    let submitX, submitY;
    
    if (submitButtonSelection.includes(',')) {
      // User provided coordinates
      [submitX, submitY] = submitButtonSelection.split(',').map(n => parseInt(n.trim()));
    } else {
      // User provided index
      const index = parseInt(submitButtonSelection) - 1;
      if (potentialSubmitButtons[index]) {
        submitX = potentialSubmitButtons[index].coordinates.x;
        submitY = potentialSubmitButtons[index].coordinates.y;
      } else {
        console.log('Invalid selection. Please try again.');
        await browser.close();
        rl.close();
        return;
      }
    }
    
    // Ask for confirmation
    const confirm = await question(`\nReady to click submit button at (${submitX}, ${submitY}). Press Enter to continue or type 'n' to cancel: `);
    
    if (confirm.toLowerCase() === 'n') {
      console.log('Operation cancelled by user.');
    } else {
      // Click the submit button
      console.log(`\nClicking submit button at position (${submitX}, ${submitY})...`);
      await page.mouse.click(submitX, submitY);
      
      // Wait a moment and take final screenshot
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'final_result.png' });
      console.log('Final screenshot saved as final_result.png');
      
      console.log('\nComment submission completed!');
    }
    
  } catch (error) {
    console.error('Error during automation:', error.message);
  } finally {
    // Clean up
    const keepOpen = await question('\nKeep browser open? (y/n): ');
    
    if (keepOpen.toLowerCase() !== 'y') {
      await browser.close();
    } else {
      console.log('Browser remains open. Close it manually when done.');
    }
    
    rl.close();
    console.log('\n=== Script completed ===');
  }
}

// Run the interactive automation
interactiveGuestbookComment().catch(console.error);
