import dotenv from "dotenv";
import {
  Agent,
  Runner,
  run,
  tool,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
  OpenAIProvider,
} from "@openai/agents";
import { z } from "zod";
import puppeteer from "puppeteer";
import fs from "fs";
import { OpenAI } from "openai";

dotenv.config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: false,
  args: ["--start-maximized", "--disable-extensions", "--disable-file-system"],
  defaultViewport: null,
});

const page = await browser.newPage();

const openaiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
const modelProvider = new OpenAIProvider({
  openAIClient: openaiClient,
});
setDefaultOpenAIClient(openaiClient);
setOpenAIAPI("chat_completions");
setTracingDisabled(true);


const takeScreenShot = tool({
  name: "take_screenshot",
  description: "Take screenshot of current page for inspection",
  parameters: z.object({}),
  async execute() {
    const buffer = await page.screenshot();
    const filePath = `screenshot-${Date.now()}.png`;
    await fs.promises.writeFile(filePath, buffer);
    return { filePath };
  },
});

const openURL = tool({
  name: "open_url",
  description: "Open a webpage",
  parameters: z.object({ url: z.string() }),
  async execute({ url }) {
    await page.goto(url, { waitUntil: "networkidle2" });
    await delay(3000); 
    console.log("Navigated to:", url);
    return { success: true };
  },
});


const getPageStructure = tool({
  name: "get_page_structure",
  description: "Get the DOM structure of the current page, focusing on elements that is being requested",
  parameters: z.object({
    focusArea: z.string().nullable().default("form").describe("Specific area to focus on like 'form', 'inputs', 'buttons'")
  }),
  async execute({ focusArea = "form" }) {
    const structure = await page.evaluate((focus) => {
      const elements = [];
      
      // Get all form elements
      const forms = document.querySelectorAll('form');
      forms.forEach((form, formIndex) => {
        elements.push({
          tag: 'form',
          selector: `form:nth-child(${formIndex + 1})`,
          id: form.id,
          className: form.className,
          action: form.action
        });
      });

      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, inputIndex) => {
        const selectors = [];
        if (input.id) selectors.push(`#${input.id}`);
        if (input.name) selectors.push(`[name="${input.name}"]`);
        if (input.type) selectors.push(`input[type="${input.type}"]`);
        if (input.placeholder) selectors.push(`[placeholder="${input.placeholder}"]`);
        
        elements.push({
          tag: input.tagName.toLowerCase(),
          type: input.type,
          id: input.id,
          name: input.name,
          className: input.className,
          placeholder: input.placeholder,
          selectors: selectors,
          value: input.value,
          required: input.required,
          visible: input.offsetParent !== null
        });
      });

      const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
      buttons.forEach((button, buttonIndex) => {
        const selectors = [];
        
        if (button.id) selectors.push(`#${button.id}`);
        if (button.className) {
          const classes = button.className.split(' ').filter(c => c);
          if (classes.length > 0) selectors.push(`.${classes.join('.')}`);
        }
        if (button.type) selectors.push(`[type="${button.type}"]`);
        
        elements.push({
          tag: button.tagName.toLowerCase(),
          type: button.type,
          id: button.id,
          className: button.className,
          textContent: button.textContent?.trim(),
          value: button.value,
          selectors: selectors,
          visible: button.offsetParent !== null
        });
      });

      return elements;
    }, focusArea || "form");
    
    console.log('Page structure:', structure);
    return { structure };
  },
});


const fillInput = tool({
  name: "fill_input",
  description: "Fill a form input field, will try multiple selectors if provided",
  parameters: z.object({
    selectors: z.array(z.string()).describe("Array of CSS selectors to try in order"),
    value: z.string().describe("Value to type in"),
  }),
  async execute({ selectors, value }) {
    let success = false;
    let lastError = null;
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector, { clickCount: 3 });
        await delay(500);
        await page.type(selector, value, { delay: 100 });
        
        console.log(`Successfully filled ${selector} with "${value}"`);
        success = true;
        break;
      } catch (error) {
        lastError = error.message;
        console.log(`Failed to fill ${selector}: ${error.message}`);
        continue;
      }
    }
    
    if (!success) {
      throw new Error(`Failed to fill input with any selector. Last error: ${lastError}`);
    }
    
    return { success: true, usedSelector: selectors.find(s => success) };
  },
});


const clickElement = tool({
  name: "click_element",
  description: "Click an element, will try multiple selectors if provided",
  parameters: z.object({
    selectors: z.array(z.string()).describe("Array of CSS selectors to try in order"),
  }),
  async execute({ selectors }) {
    let success = false;
    let lastError = null;
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
        
        console.log(`Successfully clicked element: ${selector}`);
        success = true;
        break;
      } catch (error) {
        lastError = error.message;
        console.log(`Failed to click ${selector}: ${error.message}`);
        continue;
      }
    }
    
    if (!success) {
      throw new Error(`Failed to click element with any selector. Last error: ${lastError}`);
    }
    
    return { success: true, usedSelector: selectors.find(s => success) };
  },
});



const websiteAutomationAgent = new Agent({
  name: "Website Automation Agent",
  instructions: `
You are a **reliable DOM-based browser automation agent** with enhanced DOM inspection capabilities.

Your primary goal is to automate actions in a web browser using the available tools.  
You can now inspect the DOM structure to find the correct selectors before attempting actions.

---

## Enhanced Workflow:
1. **Always start by opening the given URL** with 'open_url'.  
2. **After opening, get the page structure** with 'get_page_structure' to understand available elements.
3. **Take a screenshot** to see the visual layout.
4. **Use the DOM structure** to identify the correct selectors for form fields.
5. **For each action**, provide multiple selector options in order of preference.
6. **Always take screenshots** after each action to confirm results.

---

## Tools Usage:
- **open_url(url)** → Navigate to a webpage.
- **get_page_structure(focusArea)** → Get DOM elements. Use this to find form fields and buttons.
- **take_screenshot** → Must be called after every action.
- **fill_input(selectors, value)** → Provide an array of selectors to try. The tool will attempt them in order.
- **click_element(selectors)** → Provide an array of selectors for buttons/clickable elements.

---

## Selector Strategy:
When you get the page structure, create selector arrays in this priority order:
1. ID selector (#elementId) - most reliable
2. Name attribute ([name="fieldName"]) - very reliable  
3. Placeholder attribute ([placeholder="text"]) - good for identification
4. Type + additional attributes (input[type="email"]) - fallback
5. Class selectors - last resort

Example:
For an email field, provide: ["#email", "[name='email']", "[placeholder*='email']", "input[type='email']"]

---

## Form Filling Enhanced Workflow:
1. Navigate to the signup page using 'open_url'.
2. Use 'get_page_structure' to understand the form layout.
3. Take a screenshot to see the visual form.
4. For each input field:
   - Identify the field from the structure data
   - Create multiple selector options
   - Use 'fill_input' with the selector array
   - Take a screenshot to verify
5. Find the submit button from the structure
6. Use 'click_element' with multiple selector options for the button
7. Take a final screenshot to verify success

---

## Error Handling:
- If a selector fails, the tools will automatically try the next one in the array
- Always provide at least 2-3 selector options when possible
- If all selectors fail, check the page structure again - the DOM might have changed

---

Now, follow these enhanced rules to complete the user's request reliably.
  `,
  tools: [takeScreenShot, openURL, getPageStructure, fillInput, clickElement],
  model: "gemini-2.5-flash",
});


async function chatWithAgent(query) {
  const runner = new Runner({ modelProvider });
  try {
    const response = await runner.run(websiteAutomationAgent, query, {
      maxTurns: 30,
    });
    console.log('Final response:', response.finalOutput);
    await browser.close();
  } catch (error) {
    console.error('Agent execution failed:', error);
    await browser.close();
  }
}

chatWithAgent(`
  Go to https://ui.chaicode.com/auth/signup
  
Then:
- Fill the form data:
  - First Name: Tejas
  - Last Name: Dherange
  - Email: tejas.dherange@gmail.com
  - Password: Tejas@12345
  - Confirm Password: Tejas@12345

- Finally, click the "Create Account" button.
- Take a screenshot to confirm the account creation attempt.
`);