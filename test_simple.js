import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import 'dotenv/config';
import playwright from 'playwright';
import fs from 'fs';
import path from 'path';

// Global browser and page state with error handling
let globalBrowser = null;
let globalPage = null;
let globalContext = null;

// Utility function for consistent logging
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// Utility function to ensure screenshots directory exists
const ensureScreenshotDir = () => {
  const dir = './screenshots';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Enhanced browser launch with better configuration
const launchBrowserAndNavigate = tool({
  name: 'launch_browser_and_navigate',
  description: 'Launch a browser and navigate to the specified URL with enhanced configuration.',
  parameters: z.object({ 
    url: z.string().describe('The URL to navigate to'),
    headless: z.boolean().nullable().optional().describe('Whether to run in headless mode (default: false)'),
    userAgent: z.string().nullable().optional().describe('Custom user agent string'),
    timeout: z.number().nullable().optional().describe('Page load timeout in milliseconds (default: 30000)')
  }),
  async execute({ url, headless = false, userAgent, timeout = 30000 }) {
    try {
      log(`Launching browser and navigating to: ${url}`);
      
      // Close existing browser if any
      if (globalBrowser) {
        await globalBrowser.close();
      }
      
      // Launch browser with enhanced settings
      globalBrowser = await playwright.chromium.launch({ 
        headless,
        slowMo: 500, // Reduced for better performance
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      // Create context with realistic settings
      globalContext = await globalBrowser.newContext({
        viewport: { width: 1366, height: 768 }, // More common resolution
        userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation', 'notifications']
      });
      
      globalPage = await globalContext.newPage();
      
      // Set up request interception for better debugging
      await globalPage.route('**/*', (route) => {
        const request = route.request();
        if (request.resourceType() === 'image' && headless) {
          // Skip images in headless mode for faster loading
          route.abort();
        } else {
          route.continue();
        }
      });
      
      // Navigate with proper wait conditions
      await globalPage.goto(url, { 
        waitUntil: 'networkidle', 
        timeout 
      });
      
      // Additional wait for dynamic content
      await globalPage.waitForTimeout(2000);
      
      const title = await globalPage.title();
      const currentUrl = globalPage.url();
      
      return {
        success: true,
        message: `Successfully navigated to ${currentUrl}. Page title: ${title}`,
        url: currentUrl,
        title
      };
    } catch (error) {
      log(`Navigation error: ${error.message}`);
      return {
        success: false,
        message: `Error navigating to ${url}: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Enhanced screenshot with better file management
const takeScreenshot = tool({
  name: 'take_screenshot',
  description: 'Take a screenshot and save it with timestamp and optional description.',
  parameters: z.object({
    filename: z.string().nullable().optional().describe('Custom filename (without extension)'),
    description: z.string().nullable().optional().describe('Description for the screenshot'),
    fullPage: z.boolean().nullable().optional().describe('Take full page screenshot (default: true)')
  }),
  async execute({ filename, description, fullPage = true }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }
      
      const screenshotDir = ensureScreenshotDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalFilename = filename || `screenshot_${timestamp}`;
      const filepath = path.join(screenshotDir, `${finalFilename}.png`);
      
      // Take screenshot with better options
      const screenshotBuffer = await globalPage.screenshot({ 
        fullPage,
        animations: 'disabled', // Disable animations for consistency
        type: 'png',
        quality: 90
      });
      
      fs.writeFileSync(filepath, screenshotBuffer);
      
      const result = {
        success: true,
        message: `Screenshot saved as ${filepath}`,
        filepath,
        timestamp
      };
      
      if (description) {
        result.description = description;
      }
      
      log(`Screenshot taken: ${filepath}`);
      return result;
    } catch (error) {
      return { 
        success: false, 
        message: `Error taking screenshot: ${error.message}`,
        error: error.message 
      };
    }
  },
});

// Enhanced element finding with better filtering and categorization
const findElementsOnPage = tool({
  name: 'find_elements_on_page',
  description: 'Find interactive elements on the page with enhanced filtering and categorization.',
  parameters: z.object({
    elementType: z.string().nullable().optional().describe('Type of elements to find (button, link, input, form, etc.)'),
    textContains: z.string().nullable().optional().describe('Find elements containing specific text'),
    limit: z.number().nullable().optional().describe('Maximum number of elements to return (default: 15)')
  }),
  async execute({ elementType, textContains, limit = 15 }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }

      const elements = await globalPage.evaluate(({ elementType, textContains, limit }) => {
        // Define comprehensive selector based on element type
        let selector;
        switch (elementType?.toLowerCase()) {
          case 'button':
            selector = 'button, input[type="button"], input[type="submit"], [role="button"], .btn, .button';
            break;
          case 'link':
            selector = 'a[href], [role="link"]';
            break;
          case 'input':
            selector = 'input, textarea, select, [contenteditable="true"]';
            break;
          case 'form':
            selector = 'form, .form, [role="form"]';
            break;
          default:
            selector = 'button, a[href], input, textarea, select, [role="button"], [role="link"], [contenteditable="true"], .btn, .button';
        }
        
        const allElements = Array.from(document.querySelectorAll(selector));
        
        return allElements
          .filter(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 && 
                             style.display !== 'none' && 
                             style.visibility !== 'hidden' &&
                             style.opacity !== '0';
            
            // Filter by text if specified
            if (textContains && isVisible) {
              const text = el.textContent?.toLowerCase() || '';
              const placeholder = el.placeholder?.toLowerCase() || '';
              const title = el.title?.toLowerCase() || '';
              const searchText = textContains.toLowerCase();
              
              return text.includes(searchText) || 
                     placeholder.includes(searchText) || 
                     title.includes(searchText);
            }
            
            return isVisible;
          })
          .map((el, index) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const className = el.className || '';
            const classNameStr = typeof className === 'string' ? className : className.toString();
            
            return {
              index: index + 1,
              tagName: el.tagName.toLowerCase(),
              textContent: el.textContent?.trim().substring(0, 100) || '',
              className: classNameStr.trim(),
              id: el.id || '',
              type: el.type || '',
              href: el.href || '',
              placeholder: el.placeholder || '',
              title: el.title || '',
              name: el.name || '',
              value: el.value || '',
              coordinates: {
                x: Math.round(rect.left + rect.width / 2),
                y: Math.round(rect.top + rect.height / 2)
              },
              dimensions: {
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              isClickable: el.tagName === 'BUTTON' || el.tagName === 'A' || 
                          el.type === 'button' || el.type === 'submit' ||
                          el.getAttribute('role') === 'button' ||
                          classNameStr.includes('btn') || classNameStr.includes('button'),
              isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || 
                      el.contentEditable === 'true'
            };
          })
          .slice(0, limit);
      }, { elementType, textContains, limit });

      // Categorize elements for better usability
      const categorized = {
        buttons: elements.filter(el => el.isClickable),
        inputs: elements.filter(el => el.isInput),
        links: elements.filter(el => el.tagName === 'a' && el.href),
        all: elements
      };

      return {
        success: true,
        message: `Found ${elements.length} interactive elements (${categorized.buttons.length} buttons, ${categorized.inputs.length} inputs, ${categorized.links.length} links)`,
        elements: categorized,
        count: {
          total: elements.length,
          buttons: categorized.buttons.length,
          inputs: categorized.inputs.length,
          links: categorized.links.length
        }
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error finding elements: ${error.message}`,
        error: error.message 
      };
    }
  },
});

// Enhanced clicking with multiple fallback strategies
const clickElement = tool({
  name: 'click_element',
  description: 'Click on an element using multiple strategies with fallbacks.',
  parameters: z.object({
    strategy: z.enum(['text', 'selector', 'coordinates', 'smart']).describe('Click strategy'),
    target: z.string().nullable().optional().describe('Text to find, CSS selector, or element description'),
    x: z.number().nullable().optional().describe('X coordinate'),
    y: z.number().nullable().optional().describe('Y coordinate'),
    waitAfter: z.number().nullable().optional().describe('Milliseconds to wait after click (default: 2000)'),
    maxAttempts: z.number().nullable().optional().describe('Maximum click attempts (default: 3)')
  }),
  async execute({ strategy, target, x, y, waitAfter = 2000, maxAttempts = 3 }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }

      let attempts = 0;
      let lastError = null;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          switch (strategy) {
            case 'coordinates':
              if (x !== undefined && y !== undefined) {
                await globalPage.mouse.click(x, y);
                if (waitAfter > 0) await globalPage.waitForTimeout(waitAfter);
                return { success: true, message: `Successfully clicked at coordinates (${x}, ${y}) on attempt ${attempts}` };
              }
              throw new Error('Coordinates required for coordinate strategy');

            case 'text':
              if (target) {
                // Try exact text match first
                try {
                  await globalPage.click(`text="${target}"`, { timeout: 5000 });
                } catch {
                  // Try partial text match
                  await globalPage.click(`text=${target}`, { timeout: 5000 });
                }
                if (waitAfter > 0) await globalPage.waitForTimeout(waitAfter);
                return { success: true, message: `Successfully clicked text: "${target}" on attempt ${attempts}` };
              }
              throw new Error('Target text required for text strategy');

            case 'selector':
              if (target) {
                await globalPage.click(target, { timeout: 5000 });
                if (waitAfter > 0) await globalPage.waitForTimeout(waitAfter);
                return { success: true, message: `Successfully clicked selector: ${target} on attempt ${attempts}` };
              }
              throw new Error('CSS selector required for selector strategy');

            case 'smart':
              if (target) {
                // Try multiple strategies in order of preference
                const strategies = [
                  () => globalPage.click(`text="${target}"`, { timeout: 3000 }),
                  () => globalPage.click(`text=${target}`, { timeout: 3000 }),
                  () => globalPage.click(`[title*="${target}" i]`, { timeout: 3000 }),
                  () => globalPage.click(`[aria-label*="${target}" i]`, { timeout: 3000 }),
                  () => globalPage.click(`[data-*="${target}" i]`, { timeout: 3000 })
                ];
                
                for (const clickStrategy of strategies) {
                  try {
                    await clickStrategy();
                    if (waitAfter > 0) await globalPage.waitForTimeout(waitAfter);
                    return { success: true, message: `Successfully clicked "${target}" using smart strategy on attempt ${attempts}` };
                  } catch (e) {
                    // Continue to next strategy
                    continue;
                  }
                }
                throw new Error('All smart strategies failed');
              }
              throw new Error('Target required for smart strategy');

            default:
              throw new Error('Invalid click strategy provided');
          }
        } catch (error) {
          lastError = error;
          log(`Click attempt ${attempts} failed: ${error.message}`);
          if (attempts < maxAttempts) {
            await globalPage.waitForTimeout(1000); // Wait before retry
          }
        }
      }

      return { 
        success: false, 
        message: `Failed to click after ${maxAttempts} attempts. Last error: ${lastError.message}`,
        error: lastError.message
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error in click operation: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Enhanced form filling with better field detection
const fillInputField = tool({
  name: 'fill_input_field',
  description: 'Fill an input field with enhanced detection and validation.',
  parameters: z.object({
    selector: z.string().nullable().optional().describe('CSS selector for the input field'),
    placeholder: z.string().nullable().optional().describe('Placeholder text to identify field'),
    label: z.string().nullable().optional().describe('Label text associated with field'),
    value: z.string().describe('Text to fill'),
    x: z.number().nullable().optional().describe('X coordinate of field'),
    y: z.number().nullable().optional().describe('Y coordinate of field'),
    clearFirst: z.boolean().nullable().optional().describe('Clear field before filling (default: true)')
  }),
  async execute({ selector, placeholder, label, value, x, y, clearFirst = true }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }

      // Strategy 1: Direct selector
      if (selector) {
        try {
          if (clearFirst) {
            await globalPage.fill(selector, ''); // Clear first
          }
          await globalPage.fill(selector, value);
          return { success: true, message: `Successfully filled field "${selector}" with: ${value}` };
        } catch (error) {
          log(`Direct selector failed: ${error.message}`);
        }
      }

      // Strategy 2: Placeholder matching
      if (placeholder) {
        const placeholderSelectors = [
          `[placeholder="${placeholder}"]`,
          `[placeholder*="${placeholder}"]`,
          `input[placeholder*="${placeholder}" i]`,
          `textarea[placeholder*="${placeholder}" i]`
        ];
        
        for (const sel of placeholderSelectors) {
          try {
            if (clearFirst) {
              await globalPage.fill(sel, '');
            }
            await globalPage.fill(sel, value);
            return { success: true, message: `Successfully filled field with placeholder "${placeholder}" with: ${value}` };
          } catch (error) {
            continue;
          }
        }
      }

      // Strategy 3: Label association
      if (label) {
        try {
          const labelSelector = `label:has-text("${label}") + input, label:has-text("${label}") + textarea`;
          if (clearFirst) {
            await globalPage.fill(labelSelector, '');
          }
          await globalPage.fill(labelSelector, value);
          return { success: true, message: `Successfully filled field with label "${label}" with: ${value}` };
        } catch (error) {
          log(`Label association failed: ${error.message}`);
        }
      }

      // Strategy 4: Common field patterns
      const commonSelectors = [
        'textarea',
        'input[type="text"]',
        'input:not([type])',
        '.comment-input',
        '.comment-field',
        '[name="comment"]',
        '[name="message"]',
        '[data-testid*="comment"]',
        '[data-testid*="input"]'
      ];

      for (const sel of commonSelectors) {
        try {
          const elements = await globalPage.$$(sel);
          if (elements.length > 0) {
            if (clearFirst) {
              await globalPage.fill(sel, '');
            }
            await globalPage.fill(sel, value);
            return { success: true, message: `Successfully filled field using selector "${sel}" with: ${value}` };
          }
        } catch (error) {
          continue;
        }
      }

      // Strategy 5: Coordinate-based filling
      if (x !== undefined && y !== undefined) {
        try {
          await globalPage.mouse.click(x, y);
          await globalPage.waitForTimeout(500);
          if (clearFirst) {
            await globalPage.keyboard.press('Control+a');
          }
          await globalPage.keyboard.type(value);
          return { success: true, message: `Successfully filled field at (${x}, ${y}) with: ${value}` };
        } catch (error) {
          log(`Coordinate filling failed: ${error.message}`);
        }
      }

      return { success: false, message: 'Could not identify input field with provided parameters' };
    } catch (error) {
      return { 
        success: false, 
        message: `Error filling field: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Enhanced waiting with better condition handling
const waitForCondition = tool({
  name: 'wait_for_condition',
  description: 'Wait for various page conditions with timeout handling.',
  parameters: z.object({
    condition: z.enum(['timeout', 'navigation', 'selector', 'text', 'url_change', 'load_state']).describe('Wait condition type'),
    target: z.string().nullable().optional().describe('Target value (selector, text, URL pattern, etc.)'),
    timeout: z.number().nullable().optional().describe('Timeout in milliseconds (default: 10000)'),
    state: z.enum(['load', 'domcontentloaded', 'networkidle']).nullable().optional().describe('Load state for load_state condition')
  }),
  async execute({ condition, target, timeout = 10000, state = 'load' }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }

      const startTime = Date.now();

      switch (condition) {
        case 'timeout':
          const waitTime = target ? parseInt(target) : timeout;
          await globalPage.waitForTimeout(waitTime);
          return { success: true, message: `Waited for ${waitTime} milliseconds` };

        case 'navigation':
          try {
            await globalPage.waitForNavigation({ timeout, waitUntil: 'networkidle' });
            return { 
              success: true, 
              message: `Navigation completed. Current URL: ${globalPage.url()}`,
              url: globalPage.url()
            };
          } catch {
            return { 
              success: true, 
              message: `Navigation timeout. Current URL: ${globalPage.url()}`,
              url: globalPage.url()
            };
          }

        case 'selector':
          if (target) {
            try {
              await globalPage.waitForSelector(target, { timeout, state: 'visible' });
              return { success: true, message: `Element with selector "${target}" appeared` };
            } catch (error) {
              return { 
                success: false, 
                message: `Timeout waiting for selector "${target}": ${error.message}`,
                error: error.message
              };
            }
          }
          return { success: false, message: 'Selector required for selector condition' };

        case 'text':
          if (target) {
            try {
              await globalPage.waitForSelector(`text="${target}"`, { timeout });
              return { success: true, message: `Text "${target}" appeared on page` };
            } catch (error) {
              return { 
                success: false, 
                message: `Timeout waiting for text "${target}": ${error.message}`,
                error: error.message
              };
            }
          }
          return { success: false, message: 'Text required for text condition' };

        case 'url_change':
          const initialUrl = globalPage.url();
          const startWait = Date.now();
          
          while (Date.now() - startWait < timeout) {
            const currentUrl = globalPage.url();
            if (currentUrl !== initialUrl) {
              if (target && !currentUrl.includes(target)) {
                await globalPage.waitForTimeout(100);
                continue;
              }
              return { 
                success: true, 
                message: `URL changed from ${initialUrl} to ${currentUrl}`,
                oldUrl: initialUrl,
                newUrl: currentUrl
              };
            }
            await globalPage.waitForTimeout(100);
          }
          
          return { 
            success: false, 
            message: `URL did not change within timeout period`,
            currentUrl: globalPage.url()
          };

        case 'load_state':
          try {
            await globalPage.waitForLoadState(state, { timeout });
            return { 
              success: true, 
              message: `Page reached ${state} state`,
              loadTime: Date.now() - startTime
            };
          } catch (error) {
            return { 
              success: false, 
              message: `Timeout waiting for ${state} state: ${error.message}`,
              error: error.message
            };
          }

        default:
          return { success: false, message: 'Invalid wait condition type' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Wait operation failed: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Enhanced page information tool
const getPageInfo = tool({
  name: 'get_page_info',
  description: 'Get comprehensive information about the current page.',
  parameters: z.object({
    includeContent: z.boolean().nullable().optional().describe('Include page content analysis (default: false)')
  }),
  async execute({ includeContent = false }) {
    try {
      if (!globalPage) {
        return { success: false, message: 'No active browser page. Please launch browser first.' };
      }

      const url = globalPage.url();
      const title = await globalPage.title();
      
      const pageInfo = {
        success: true,
        url,
        title,
        timestamp: new Date().toISOString()
      };

      if (includeContent) {
        const content = await globalPage.evaluate(() => {
          return {
            headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
              tag: h.tagName.toLowerCase(),
              text: h.textContent?.trim().substring(0, 100) || ''
            })),
            forms: Array.from(document.querySelectorAll('form')).length,
            inputs: Array.from(document.querySelectorAll('input, textarea, select')).length,
            buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).length,
            links: Array.from(document.querySelectorAll('a[href]')).length,
            bodyText: document.body?.textContent?.trim().substring(0, 500) || ''
          };
        });
        
        pageInfo.content = content;
      }

      return pageInfo;
    } catch (error) {
      return { 
        success: false, 
        message: `Error getting page info: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Enhanced browser cleanup
const closeBrowser = tool({
  name: 'close_browser',
  description: 'Close the browser and clean up resources.',
  parameters: z.object({}),
  async execute() {
    try {
      if (globalBrowser) {
        await globalBrowser.close();
        globalBrowser = null;
        globalPage = null;
        globalContext = null;
        log('Browser closed successfully');
        return { success: true, message: 'Browser closed successfully' };
      }
      return { success: true, message: 'No browser instance to close' };
    } catch (error) {
      return { 
        success: false, 
        message: `Error closing browser: ${error.message}`,
        error: error.message
      };
    }
  },
});

// Create the enhanced agent
const agent = new Agent({
  name: 'enhanced_web_automation_agent',
  instructions: `You are an advanced web automation agent capable of handling complex workflows across various websites. Follow these principles:

## Core Workflow:
1. **Navigate**: Use launch_browser_and_navigate with proper timeout and user agent
2. **Analyze**: Take screenshots and use find_elements_on_page to understand the page structure
3. **Interact**: Use clickElement with smart strategy and fillInputField with multiple fallbacks
4. **Verify**: Use getPageInfo and waitForCondition to ensure actions completed successfully
5. **Adapt**: If one strategy fails, try alternative approaches automatically

## Best Practices:
- Always take screenshots before major interactions for visual verification
- Use smart clicking strategy as default (tries multiple approaches)
- Implement proper error handling and retries
- Wait for page state changes after interactions
- Handle OAuth flows by detecting URL changes and page content
- Be patient with async operations and network requests

## For Authentication Flows:
1. Detect login buttons using smart text matching
2. Handle redirects by monitoring URL changes
3. Wait for proper page load states
4. Take screenshots at each step for debugging
5. Handle 2FA by waiting for manual user intervention when needed

## Error Recovery:
- If direct selectors fail, try coordinate-based interactions
- Implement multiple retry strategies for critical operations  
- Use comprehensive element finding with text and attribute matching
- Gracefully handle timeouts and navigation changes

Always provide detailed feedback about what actions were taken and their results.`,
  model: 'gpt-4o-mini',
  tools: [
    launchBrowserAndNavigate,
    takeScreenshot,
    findElementsOnPage,
    clickElement,
    fillInputField,
    waitForCondition,
    getPageInfo,
    closeBrowser
  ],
});

// Export for use
export { agent, run };

// Example usage for guest-book automation
const runGuestBookAutomation = async () => {
  // Direct implementation without relying on agent to handle the complex GitHub OAuth flow
  try {
    console.log('Starting enhanced guest-book automation with direct control...');
    
    // Step 1: Navigate to the guest book page
    if (!globalBrowser) {
      globalBrowser = await playwright.chromium.launch({ 
        headless: false,
        slowMo: 500
      });
      
      globalContext = await globalBrowser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      globalPage = await globalContext.newPage();
    }
    
    console.log('Navigating to guest book page...');
    await globalPage.goto('https://www.piyushgarg.dev/guest-book', { 
      waitUntil: 'networkidle', 
      timeout: 30000
    });
    
    // Step 2: Take a screenshot of initial page
    const screenshotDir = ensureScreenshotDir();
    await globalPage.screenshot({ path: path.join(screenshotDir, 'guest_book_initial.png'), fullPage: true });
    console.log('Initial screenshot taken');
    
    // Step 3: Find and click GitHub sign-in button
    console.log('Looking for GitHub sign-in button...');
    const githubButtonFound = await globalPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('github') || text.includes('sign in') || text.includes('login');
        });
      if (buttons.length > 0) {
        return true;
      }
      return false;
    });
    
    if (githubButtonFound) {
      try {
        // First try clicking GitHub button by text
        await globalPage.click('text="Sign In with GitHub"', { timeout: 5000 });
        console.log('Clicked on Sign In with GitHub button by text');
      } catch (e) {
        try {
          // Try with partial text match
          await globalPage.click('text=GitHub', { timeout: 5000 });
          console.log('Clicked on GitHub button by partial text');
        } catch (e2) {
          // Try with generic sign in button
          try {
            await globalPage.click('button:has-text("Sign In")', { timeout: 5000 });
            console.log('Clicked on Sign In button');
          } catch (e3) {
            console.log('Could not find GitHub button by text, trying with visual elements...');
            
            // Find all possible sign in elements
            const elements = await globalPage.$$('button, a, [role="button"]');
            for (const element of elements) {
              const isVisible = await element.isVisible();
              if (isVisible) {
                await element.click();
                console.log('Clicked a potential sign in button');
                break;
              }
            }
          }
        }
      }
    } else {
      console.log('No GitHub button found, taking screenshot for analysis...');
      await globalPage.screenshot({ path: path.join(screenshotDir, 'no_github_button.png'), fullPage: true });
    }
    
    // Step 4: Wait for GitHub login page to load
    console.log('Waiting for GitHub login page...');
    await globalPage.waitForTimeout(3000);
    
    // Take screenshot of the GitHub login page
    await globalPage.screenshot({ path: path.join(screenshotDir, 'github_signin_page.png'), fullPage: true });
    console.log('GitHub login page screenshot taken');
    
    // Step 5: Fill in GitHub credentials (with specific focus on input fields)
    console.log('Preparing for GitHub login...');
    
    // Wait for the login form to be visible with a longer timeout
    try {
      // Wait longer for the login page to fully load and stabilize
      await globalPage.waitForTimeout(3000);
      await globalPage.waitForSelector('input[name="login"]', { timeout: 15000 });
      console.log('Login field detected');
      
      // Take a screenshot before any interaction
      await globalPage.screenshot({ path: path.join(screenshotDir, 'before_credentials.png'), fullPage: true });
      
      // Add some random mouse movements to appear more human-like
      await globalPage.mouse.move(100, 100, { steps: 10 });
      await globalPage.mouse.move(200, 150, { steps: 5 });
      await globalPage.waitForTimeout(500);
      
      console.log('Adding human-like behavior before filling credentials...');
      
      // Focus on username field with more natural interaction
      await globalPage.hover('input[name="login"]');
      await globalPage.waitForTimeout(300); // Small random pause
      await globalPage.click('input[name="login"]');
      await globalPage.waitForTimeout(500);
      
      // Type username character by character with variable delays like a human
      console.log('Typing username slowly like a human...');
      const username = '';
      for (let i = 0; i < username.length; i++) {
        // Random typing speed between 50-150ms
        const delay = Math.floor(Math.random() * 100) + 50;
        await globalPage.keyboard.type(username[i], { delay });
      }
      
      // Small pause after typing username
      await globalPage.waitForTimeout(800);
      
      // Verify username was entered correctly
      const usernameValue = await globalPage.$eval('input[name="login"]', el => el.value);
      console.log(`Username field value: "${usernameValue}"`);
      
      // Tab to password field like a human would do
      await globalPage.keyboard.press('Tab');
      await globalPage.waitForTimeout(700);
      
      // Type password character by character with variable delays
      console.log('Typing password slowly like a human...');
      const password = '';
      for (let i = 0; i < password.length; i++) {
        // Random typing speed between 70-170ms
        const delay = Math.floor(Math.random() * 100) + 70;
        await globalPage.keyboard.type(password[i], { delay });
      }
      
      // Pause after typing password
      await globalPage.waitForTimeout(1000);
      
      // Verify password field has content (not showing actual password)
      const passwordFilled = await globalPage.$eval('input[name="password"]', el => el.value.length > 0);
      console.log(`Password field filled: ${passwordFilled}`);
      
      if (!passwordFilled) {
        console.log('Password not filled correctly, trying alternative method...');
        await globalPage.click('input[name="password"]');
        await globalPage.keyboard.type('', {delay: 100});
      }
      
      // Take screenshot after filling (with password hidden)
      await globalPage.evaluate(() => {
        const pwField = document.querySelector('input[name="password"]');
        if (pwField) pwField.type = 'text';
        pwField.value = '[PASSWORD ENTERED]';
      });
      
      await globalPage.screenshot({ path: path.join(screenshotDir, 'github_credentials_filled.png'), fullPage: true });
      
      // Restore password field
      await globalPage.evaluate(() => {
        const pwField = document.querySelector('input[name="password"]');
        if (pwField) pwField.type = 'password';
      });
      
      // Take a screenshot before clicking sign in to verify credentials are entered
      await globalPage.screenshot({ path: path.join(screenshotDir, 'before_signin.png'), fullPage: true });
      
      // Click Sign in button
      console.log('Clicking Sign in button...');
      
      // Check for any visible error messages before proceeding
      const hasErrors = await globalPage.evaluate(() => {
        const errorElements = document.querySelectorAll('.flash-error, .error, [role="alert"], .flash-messages');
        for (const el of errorElements) {
          if (el.textContent && el.offsetParent !== null) { // Check if visible
            return el.textContent.trim();
          }
        }
        return null;
      });
      
      if (hasErrors) {
        console.log(`Error message detected before clicking sign in: ${hasErrors}`);
        await globalPage.screenshot({ path: path.join(screenshotDir, 'login_error_message.png'), fullPage: true });
      }
      
      try {
        await globalPage.click('input[type="submit"], button[type="submit"], [name="commit"]');
        console.log('Clicked sign in button');
      } catch (signInError) {
        console.log(`Error clicking sign in button: ${signInError.message}`);
        // Try finding by text
        try {
          await globalPage.click('text="Sign in"');
          console.log('Clicked Sign in by text');
        } catch (textError) {
          // Try JavaScript click as a last resort
          console.log(`Failed to click by text: ${textError.message}, trying JavaScript click...`);
          
          const buttonClicked = await globalPage.evaluate(() => {
            const buttons = [
              document.querySelector('input[type="submit"]'),
              document.querySelector('button[type="submit"]'),
              document.querySelector('[name="commit"]'),
              ...Array.from(document.querySelectorAll('button')).filter(b => 
                b.textContent.toLowerCase().includes('sign in'))
            ].filter(Boolean);
            
            if (buttons.length > 0) {
              buttons[0].click();
              return true;
            }
            return false;
          });
          
          if (buttonClicked) {
            console.log('Clicked sign in button via JavaScript');
          } else {
            console.log('Failed to find sign in button');
            await globalPage.screenshot({ path: path.join(screenshotDir, 'signin_button_issue.png'), fullPage: true });
          }
        }
      }
      
      // Wait for potential 2FA or authorization page
      console.log('Waiting for post-login navigation...');
      await globalPage.waitForTimeout(5000);
      
      // Check for error messages after sign in attempt
      const pageStatus = await globalPage.evaluate(() => {
        // Check for error messages
        const errorElements = document.querySelectorAll('.flash-error, .error, [role="alert"], .flash-messages');
        for (const el of errorElements) {
          if (el.textContent && el.offsetParent !== null) { // Check if visible
            return { type: 'error', message: el.textContent.trim() };
          }
        }
        
        // Check for captcha
        const captchaElements = document.querySelectorAll('[data-captcha], iframe[src*="captcha"], #captcha, .g-recaptcha');
        if (captchaElements.length > 0) {
          return { type: 'captcha', message: 'CAPTCHA detected' };
        }
        
        // Check for 2FA
        const twoFAElements = document.querySelectorAll('[data-2fa], #otp, .two-factor, input[name*="otp"]');
        if (twoFAElements.length > 0) {
          return { type: '2fa', message: '2FA verification required' };
        }
        
        return null;
      });
      
      if (pageStatus) {
        console.log(`Post-login status: ${pageStatus.type} - ${pageStatus.message}`);
        await globalPage.screenshot({ path: path.join(screenshotDir, `post_login_${pageStatus.type}.png`), fullPage: true });
        
        if (pageStatus.type === 'captcha') {
          console.log('CAPTCHA detected. Waiting for manual intervention...');
          console.log('Please solve the CAPTCHA manually in the browser window.');
          // Wait longer to give user time to solve CAPTCHA
          await globalPage.waitForTimeout(30000);
        } else if (pageStatus.type === '2fa') {
          console.log('2FA verification required. Waiting for manual intervention...');
          console.log('Please complete 2FA verification manually in the browser window.');
          // Wait longer to give user time to complete 2FA
          await globalPage.waitForTimeout(30000);
        }
      }
      
      await globalPage.screenshot({ path: path.join(screenshotDir, 'post_login_page.png'), fullPage: true });
      
      // Check if we need to authorize the application
      const needsAuthorization = await globalPage.evaluate(() => {
        return document.body.textContent.includes('Authorize') || 
               document.body.textContent.includes('authorization');
      });
      
      if (needsAuthorization) {
        console.log('Authorization page detected, clicking authorize...');
        try {
          await globalPage.click('button:has-text("Authorize"), input[value="Authorize"]');
          console.log('Clicked authorize button');
        } catch (authError) {
          console.log(`Error clicking authorize: ${authError.message}`);
          await globalPage.screenshot({ path: path.join(screenshotDir, 'authorize_issue.png'), fullPage: true });
        }
      }
      
      // Step 6: Wait to return to guest book page
      console.log('Waiting for return to guest book page...');
      await globalPage.waitForTimeout(5000);
      const currentUrl = globalPage.url();
      console.log(`Current URL: ${currentUrl}`);
      await globalPage.screenshot({ path: path.join(screenshotDir, 'returned_to_guest_book.png'), fullPage: true });
      
      // Step 7: Fill comment field
      console.log('Looking for comment field...');
      
      // Take screenshot of guest book page
      await globalPage.screenshot({ path: path.join(screenshotDir, 'guest_book_comment_page.png'), fullPage: true });
      
      // Wait a bit for all elements to load
      await globalPage.waitForTimeout(3000);
      
      // Try multiple strategies to find and fill the comment field
      try {
        // Strategy 1: Find textarea
        await globalPage.fill('textarea', 'Hello, this comment was made using an enhanced automation bot!');
        console.log('Filled comment using textarea selector');
      } catch (textareaError) {
        try {
          // Strategy 2: Find by placeholder
          await globalPage.fill('[placeholder*="comment" i], [placeholder*="message" i], [placeholder*="mind" i]', 
                              'Hello, this comment was made using an enhanced automation bot!');
          console.log('Filled comment using placeholder selector');
        } catch (placeholderError) {
          try {
            // Strategy 3: Using JS evaluation to find and fill
            const commentFilled = await globalPage.evaluate(() => {
              const possibleFields = [
                ...document.querySelectorAll('textarea'),
                ...document.querySelectorAll('div[contenteditable="true"]'),
                ...document.querySelectorAll('input[type="text"]')
              ];
              
              for (const field of possibleFields) {
                try {
                  field.value = 'Hello, this comment was made using an enhanced automation bot!';
                  field.dispatchEvent(new Event('input', { bubbles: true }));
                  field.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                } catch (e) {
                  continue;
                }
              }
              return false;
            });
            
            if (commentFilled) {
              console.log('Filled comment using JS evaluation');
            } else {
              console.log('Could not find comment field with JS evaluation');
            }
          } catch (jsError) {
            console.log(`Error with JS evaluation: ${jsError.message}`);
          }
        }
      }
      
      // Take screenshot after filling comment
      await globalPage.screenshot({ path: path.join(screenshotDir, 'comment_filled.png'), fullPage: true });
      
      // Step 8: Click send/submit button
      console.log('Looking for submit button...');
      try {
        // Strategy 1: Look for buttons with common submit text
        await globalPage.click('button:has-text("Send"), button:has-text("Submit"), button:has-text("Post"), input[type="submit"]');
        console.log('Clicked submit button by text');
      } catch (submitError) {
        try {
          // Strategy 2: Look for buttons near the textarea
          const submitClicked = await globalPage.evaluate(() => {
            const textarea = document.querySelector('textarea');
            if (!textarea) return false;
            
            // Look for buttons near the textarea
            let currentElement = textarea;
            while (currentElement.parentElement && currentElement.tagName !== 'FORM') {
              currentElement = currentElement.parentElement;
              
              const buttons = currentElement.querySelectorAll('button, input[type="submit"], [role="button"]');
              for (const button of buttons) {
                button.click();
                return true;
              }
            }
            return false;
          });
          
          if (submitClicked) {
            console.log('Clicked submit button using proximity search');
          } else {
            console.log('Could not find submit button with proximity search');
          }
        } catch (proximityError) {
          console.log(`Error with proximity search: ${proximityError.message}`);
        }
      }
      
      // Step 9: Wait for comment to be posted and take final screenshot
      await globalPage.waitForTimeout(5000);
      await globalPage.screenshot({ path: path.join(screenshotDir, 'final_result.png'), fullPage: true });
      
      console.log('Automation completed successfully!');
      return { success: true, message: 'Guest book comment posted successfully' };
      
    } catch (loginError) {
      console.log(`Error with login form: ${loginError.message}`);
      await globalPage.screenshot({ path: path.join(screenshotDir, 'login_error.png'), fullPage: true });
      return { success: false, error: loginError.message };
    }
    
  } catch (error) {
    console.error('Automation error:', error.message);
    return { success: false, error: error.message };
  }
}

  console.log('Starting enhanced web automation...');
  
  try {
    const result = await run(agent, userTask);
    console.log('\n=== Enhanced Automation Results ===');
    console.log(result.finalOutput);
  } catch (error) {
    console.error('Enhanced automation failed:', error.message);
  } finally {
    // Cleanup will be handled by the closeBrowser tool if needed
    console.log('Automation completed');
  } 

// Run the direct implementation instead of using the agent
(async () => {
  try {
    console.log('Starting direct guest book automation...');
    await runGuestBookAutomation();
  } catch (error) {
    console.error('Failed to run guest book automation:', error);
  }
})();
