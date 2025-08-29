import { Agent, tool, run } from "@openai/agents";
import { z } from "zod";
import "dotenv/config";
import playwright from "playwright";
import fs from "fs";
import { chromium } from "playwright";

// Global browser and page state
let globalBrowser = null;
let globalPage = null;

//tool for launching headless browser and navigating to URL
const launchBrowserAndNavigate = tool({
  name: "launch_browser_and_navigate",
  description: "Launch a browser and navigate to the specified URL.",
  parameters: z.object({
    url: z.string().describe("The URL to navigate to"),
    headless: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether to run in headless mode (default: false)"),
  }),
  async execute({ url, headless = false }) {
    try {
      console.log(`Launching browser and navigating to: ${url}`);
      const userDataDir = "C:\\Users\\tejas\\OneDrive\\Desktop\\Tejas (Work) - Chrome.lnk";
      globalBrowser = await chromium.launchPersistentContext(userDataDir, {
        channel: "chrome" // Specify the Chrome browser

      });
      const context = await globalBrowser.newContext();
      globalPage = await context.newPage();
      await globalPage.goto(url, { waitUntil: "networkidle" });

      const title = await globalPage.title();
      return `Successfully navigated to ${url}. Page title: ${title}`;
    } catch (error) {
      return `Error navigating to ${url}: ${error.message}`;
    }
  },
});

//tool for taking screenshot and returning base64
const takeScreenshotBase64 = tool({
  name: "take_screenshot_base64",
  description:
    "Take a screenshot of the current page and return it as base64 string.",
  parameters: z.object({
    filename: z
      .string()
      .nullable()
      .optional()
      .describe("Optional filename to save the screenshot"),
  }),
  async execute({ filename }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      const screenshotBuffer = await globalPage.screenshot();
      const screenshotBase64 = screenshotBuffer.toString("base64");

      if (filename) {
        fs.writeFileSync(`${filename}.png`, screenshotBuffer);
        fs.writeFileSync(`${filename}_base64.txt`, screenshotBase64);
        console.log(
          `Screenshot saved as ${filename}.png and base64 saved as ${filename}_base64.txt`
        );
      }

      return {
        success: true,
        message: "Screenshot taken successfully",
        base64: screenshotBase64.substring(0, 100) + "...", // Truncated for display
      };
    } catch (error) {
      return `Error taking screenshot: ${error.message}`;
    }
  },
});

//tool to find elements on page and get their information
const findElementsOnPage = tool({
  name: "find_elements_on_page",
  description:
    "Find elements on the page using various selectors and return their information.",
  parameters: z.object({
    elementType: z
      .string()
      .nullable()
      .optional()
      .describe("Type of elements to find (input, button, form, etc.)"),
  }),
  async execute({ elementType }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      let elements = [];

      if (elementType === "input" || !elementType) {
        const inputs = await globalPage.$$eval("input", (inputs) =>
          inputs.map((input, index) => ({
            index,
            type: input.type,
            name: input.name,
            id: input.id,
            className: input.className,
            placeholder: input.placeholder,
            value: input.value,
            required: input.required,
            bounds: input.getBoundingClientRect(),
            visible: input.offsetWidth > 0 && input.offsetHeight > 0,
            disabled: input.disabled,
          }))
        );
        elements.push(
          ...inputs.map((input) => ({ ...input, elementType: "input" }))
        );
      }

      if (elementType === "button" || !elementType) {
        const buttons = await globalPage.$$eval("button", (buttons) =>
          buttons.map((button, index) => ({
            index,
            type: button.type,
            textContent: button.textContent?.trim(),
            className: button.className,
            id: button.id,
            bounds: button.getBoundingClientRect(),
            visible: button.offsetWidth > 0 && button.offsetHeight > 0,
            disabled: button.disabled,
          }))
        );
        elements.push(
          ...buttons.map((button) => ({ ...button, elementType: "button" }))
        );
      }

      if (elementType === "form" || !elementType) {
        const forms = await globalPage.$$eval("form", (forms) =>
          forms.map((form, index) => ({
            index,
            action: form.action,
            method: form.method,
            className: form.className,
            id: form.id,
            bounds: form.getBoundingClientRect(),
          }))
        );
        elements.push(
          ...forms.map((form) => ({ ...form, elementType: "form" }))
        );
      }

      // Also check for textarea elements
      if (elementType === "textarea" || !elementType) {
        const textareas = await globalPage.$$eval("textarea", (textareas) =>
          textareas.map((textarea, index) => ({
            index,
            name: textarea.name,
            id: textarea.id,
            className: textarea.className,
            placeholder: textarea.placeholder,
            value: textarea.value,
            required: textarea.required,
            bounds: textarea.getBoundingClientRect(),
            visible: textarea.offsetWidth > 0 && textarea.offsetHeight > 0,
            disabled: textarea.disabled,
          }))
        );
        elements.push(
          ...textareas.map((textarea) => ({
            ...textarea,
            elementType: "textarea",
          }))
        );
      }

      return {
        success: true,
        elements: elements,
        message: `Found ${elements.length} elements on the page`,
        visibleElements: elements.filter((el) => el.visible),
        inputFields: elements.filter(
          (el) =>
            (el.elementType === "input" || el.elementType === "textarea") &&
            el.visible
        ),
      };
    } catch (error) {
      return `Error finding elements: ${error.message}`;
    }
  },
});

//tool to automatically fill form with provided data
const autoFillForm = tool({
  name: "auto_fill_form",
  description:
    "Automatically detect and fill all form fields based on field names/types and provided data.",
  parameters: z.object({
    email: z.string().describe("Email address to fill in email fields"),
    password: z.string().describe("Password to fill in password fields"),
    username: z
      .string()
      .nullable()
      .optional()
      .describe("Username for username fields"),
    name: z.string().nullable().optional().describe("Name for name fields"),
    phone: z
      .string()
      .nullable()
      .optional()
      .describe("Phone number for phone fields"),
    message: z
      .string()
      .nullable()
      .optional()
      .describe("Message for message/textarea fields"),
    waitBetweenFields: z
      .number()
      .nullable()
      .optional()
      .describe("Milliseconds to wait between filling fields (default: 500)"),
  }),
  async execute({
    email,
    password,
    username,
    name,
    phone,
    message,
    waitBetweenFields = 500,
  }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      // Create formData object from individual parameters
      const formData = {};
      if (email) formData.email = email;
      if (password) formData.password = password;
      if (username) formData.username = username;
      if (name) formData.name = name;
      if (phone) formData.phone = phone;
      if (message) formData.message = message;

      // Get all form elements
      const formElements = await globalPage.$$eval(
        "input, textarea, select",
        (elements) =>
          elements.map((element, index) => ({
            index,
            tagName: element.tagName.toLowerCase(),
            type: element.type || "text",
            name: element.name,
            id: element.id,
            className: element.className,
            placeholder: element.placeholder,
            value: element.value,
            required: element.required,
            visible: element.offsetWidth > 0 && element.offsetHeight > 0,
            disabled: element.disabled,
            bounds: element.getBoundingClientRect(),
          }))
      );

      const visibleElements = formElements.filter(
        (el) => el.visible && !el.disabled
      );
      const results = [];

      for (const element of visibleElements) {
        let valueToFill = null;
        let fieldIdentifier = null;

        // Try to match field with provided data
        for (const [key, value] of Object.entries(formData)) {
          const keyLower = key.toLowerCase();
          const nameLower = (element.name || "").toLowerCase();
          const idLower = (element.id || "").toLowerCase();
          const placeholderLower = (element.placeholder || "").toLowerCase();
          const classLower = (element.className || "").toLowerCase();

          // Match by exact name or id
          if (nameLower === keyLower || idLower === keyLower) {
            valueToFill = value;
            fieldIdentifier = element.name || element.id;
            break;
          }

          // Match by contains logic for common field types
          if (
            (keyLower.includes("email") &&
              (nameLower.includes("email") ||
                idLower.includes("email") ||
                placeholderLower.includes("email") ||
                element.type === "email")) ||
            (keyLower.includes("password") &&
              (nameLower.includes("password") ||
                idLower.includes("password") ||
                placeholderLower.includes("password") ||
                element.type === "password")) ||
            (keyLower.includes("username") &&
              (nameLower.includes("username") ||
                idLower.includes("username") ||
                placeholderLower.includes("username") ||
                nameLower.includes("user"))) ||
            (keyLower.includes("name") &&
              !keyLower.includes("username") &&
              (nameLower.includes("name") ||
                idLower.includes("name") ||
                placeholderLower.includes("name"))) ||
            (keyLower.includes("phone") &&
              (nameLower.includes("phone") ||
                idLower.includes("phone") ||
                placeholderLower.includes("phone") ||
                element.type === "tel")) ||
            (keyLower.includes("message") &&
              (nameLower.includes("message") ||
                idLower.includes("message") ||
                placeholderLower.includes("message") ||
                element.tagName === "textarea"))
          ) {
            valueToFill = value;
            fieldIdentifier =
              element.name ||
              element.id ||
              `${element.tagName}[${element.index}]`;
            break;
          }
        }

        if (valueToFill) {
          try {
            // Create selector for the element
            let selector = "";
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.name) {
              selector = `${element.tagName}[name="${element.name}"]`;
            } else {
              selector = `${element.tagName}:nth-child(${element.index + 1})`;
            }

            // Fill the field
            await globalPage.fill(selector, valueToFill);
            results.push({
              success: true,
              field: fieldIdentifier,
              selector: selector,
              value: valueToFill,
              message: `Successfully filled ${fieldIdentifier} with: ${valueToFill}`,
            });

            // Wait between fields
            if (waitBetweenFields > 0) {
              await globalPage.waitForTimeout(waitBetweenFields);
            }
          } catch (fillError) {
            results.push({
              success: false,
              field: fieldIdentifier,
              error: fillError.message,
              message: `Failed to fill ${fieldIdentifier}: ${fillError.message}`,
            });
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const totalFields = Object.keys(formData).length;

      return {
        success: true,
        message: `Auto-filled ${successCount} out of ${totalFields} requested fields`,
        results: results,
        availableFields: visibleElements,
        totalElementsFound: formElements.length,
        visibleElementsFound: visibleElements.length,
      };
    } catch (error) {
      return `Error auto-filling form: ${error.message}`;
    }
  },
});

//tool to fill input field by selector or coordinates
const fillInputField = tool({
  name: "fill_input_field",
  description: "Fill an input field with text using selector or coordinates.",
  parameters: z.object({
    selector: z
      .string()
      .nullable()
      .optional()
      .describe("CSS selector for the input field"),
    x: z
      .number()
      .nullable()
      .optional()
      .describe("X coordinate if using coordinate-based filling"),
    y: z
      .number()
      .nullable()
      .optional()
      .describe("Y coordinate if using coordinate-based filling"),
    value: z.string().describe("Text to fill in the input field"),
    clearFirst: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether to clear the field first (default: true)"),
  }),
  async execute({ selector, x, y, value, clearFirst = true }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      if (selector) {
        if (clearFirst) {
          await globalPage.fill(selector, value);
        } else {
          await globalPage.type(selector, value);
        }
        return `Successfully filled field with selector "${selector}" with value: ${value}`;
      } else if (x !== undefined && y !== undefined) {
        await globalPage.mouse.click(x, y);
        if (clearFirst) {
          await globalPage.keyboard.press("Control+a");
        }
        await globalPage.keyboard.type(value);
        return `Successfully filled field at coordinates (${x}, ${y}) with value: ${value}`;
      } else {
        return "Error: Must provide either selector or coordinates (x, y)";
      }
    } catch (error) {
      return `Error filling input field: ${error.message}`;
    }
  },
});

//tool to click on screen by selector or coordinates
const clickElement = tool({
  name: "click_element",
  description: "Click on an element using selector or coordinates.",
  parameters: z.object({
    selector: z
      .string()
      .nullable()
      .optional()
      .describe("CSS selector for the element"),
    x: z
      .number()
      .nullable()
      .optional()
      .describe("X coordinate if using coordinate-based clicking"),
    y: z
      .number()
      .nullable()
      .optional()
      .describe("Y coordinate if using coordinate-based clicking"),
    doubleClick: z
      .boolean()
      .nullable()
      .optional()
      .describe("Whether to double click (default: false)"),
  }),
  async execute({ selector, x, y, doubleClick = false }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      if (selector) {
        if (doubleClick) {
          await globalPage.dblclick(selector);
          return `Successfully double-clicked element with selector: ${selector}`;
        } else {
          await globalPage.click(selector);
          return `Successfully clicked element with selector: ${selector}`;
        }
      } else if (x !== undefined && y !== undefined) {
        if (doubleClick) {
          await globalPage.mouse.dblclick(x, y);
          return `Successfully double-clicked at coordinates (${x}, ${y})`;
        } else {
          await globalPage.mouse.click(x, y);
          return `Successfully clicked at coordinates (${x}, ${y})`;
        }
      } else {
        return "Error: Must provide either selector or coordinates (x, y)";
      }
    } catch (error) {
      return `Error clicking element: ${error.message}`;
    }
  },
});

//tool to wait for navigation or specific elements
const waitForPageChange = tool({
  name: "wait_for_page_change",
  description:
    "Wait for page navigation, URL change, or specific elements to appear.",
  parameters: z.object({
    waitType: z
      .enum(["navigation", "url", "selector"])
      .describe("Type of wait: navigation, url, or selector"),
    target: z
      .string()
      .nullable()
      .optional()
      .describe("URL pattern or selector to wait for"),
    timeout: z
      .number()
      .nullable()
      .optional()
      .describe("Timeout in milliseconds (default: 10000)"),
  }),
  async execute({ waitType, target, timeout = 10000 }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      switch (waitType) {
        case "navigation":
          await globalPage.waitForNavigation({ timeout });
          return `Successfully waited for navigation. Current URL: ${globalPage.url()}`;

        case "url":
          if (target) {
            await globalPage.waitForURL(target, { timeout });
            return `Successfully waited for URL change to: ${globalPage.url()}`;
          } else {
            return "Error: URL pattern is required for URL wait type";
          }

        case "selector":
          if (target) {
            await globalPage.waitForSelector(target, { timeout });
            return `Successfully waited for selector: ${target}`;
          } else {
            return "Error: Selector is required for selector wait type";
          }

        default:
          return "Error: Invalid wait type";
      }
    } catch (error) {
      return `Error waiting for page change: ${error.message}`;
    }
  },
});

//tool to scroll the page
const scrollPage = tool({
  name: "scroll_page",
  description: "Scroll the page by specified amount.",
  parameters: z.object({
    direction: z
      .enum(["up", "down", "left", "right"])
      .describe("Direction to scroll"),
    amount: z
      .number()
      .nullable()
      .optional()
      .describe("Amount to scroll (default: 500)"),
  }),
  async execute({ direction, amount = 500 }) {
    try {
      if (!globalPage) {
        return "Error: No active browser page. Please launch browser first.";
      }

      let deltaX = 0,
        deltaY = 0;

      switch (direction) {
        case "down":
          deltaY = amount;
          break;
        case "up":
          deltaY = -amount;
          break;
        case "right":
          deltaX = amount;
          break;
        case "left":
          deltaX = -amount;
          break;
      }

      await globalPage.mouse.wheel(deltaX, deltaY);
      return `Successfully scrolled ${direction} by ${amount} pixels`;
    } catch (error) {
      return `Error scrolling page: ${error.message}`;
    }
  },
});

//tool to close browser
const closeBrowser = tool({
  name: "close_browser",
  description: "Close the browser and clean up resources.",
  parameters: z.object({}),
  async execute() {
    try {
      if (globalBrowser) {
        await globalBrowser.close();
        globalBrowser = null;
        globalPage = null;
        return "Browser closed successfully";
      } else {
        return "No browser instance to close";
      }
    } catch (error) {
      return `Error closing browser: ${error.message}`;
    }
  },
});

const agent = new Agent({
  name: "website_automation_agent",
  instructions: `You are a helpful website automation agent that can:
  you call appropriate tools for perform the operations given by the user

for example:
1. Navigate to URLs provided by users - toolname: launchBrowserAndNavigate
2. Take screenshots - toolname: takeScreenshotBase64
3. Find and interact with elements on web pages - toolname: findElementsOnPage
4. Fill forms with user-provided information using smart field detection - toolname: autoFillForm
5. Click buttons and submit forms - toolname: clickElement
6. Wait for page changes and navigation - toolname: waitForPageChange

When the user asks you to automate a website:
- Break down the task into clear, sequential steps.
- Call the appropriate tools for each step.
- Always provide helpful feedback about what you're doing.
Always use the auto_fill_form tool first as it can detect and 
fill multiple fields automatically by matching field names, IDs,
 placeholders, and types. Use coordinate-based clicking if selectors don't work.
  Always provide helpful feedback about what you're doing.`,

  tools: [
    launchBrowserAndNavigate,
    takeScreenshotBase64,
    findElementsOnPage,
    autoFillForm,
    fillInputField,
    clickElement,
    waitForPageChange,
    scrollPage,
  ],
});

// Example usage - replace with user input
const userTask = `
    step 1: Open url https://www.piyushgarg.dev/guest-book
    step 2: Click on "Sign in with GitHub" button
    step 3: Enter credentials :
                - Username: tejasdherange0099@gmail.com
                - Password: Tejas@8766Dherange
    step 4: Wait for verification
    step 5: After verification, click on "Authorize" button if required else proceed.
    step 6: Comment "hii this comment was made by bot" in the input field
    step 7: Click on "Send" button
`;

const result = await run(agent, userTask);
console.log("\n=== Agent Execution Results ===");
console.log(result.finalOutput);

// Don't forget to close the browser
// if (globalBrowser) {
//   await globalBrowser.close();
// }
