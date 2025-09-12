const readline = require("readline");

/**
 * Secure input function that masks input with asterisks
 * Supports both typing and copy-paste operations
 * @param {string} question - The prompt to display
 * @returns {Promise<string>} - The input string
 */
function askSecureInput(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);

    // Hide input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let input = "";

    const onData = (char) => {
      // Handle different key codes
      const code = char.charCodeAt(0);

      if (code === 13 || code === 10) {
        // Enter
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input.trim());
      } else if (code === 3) {
        // Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        process.exit(0);
      } else if (code === 127 || code === 8) {
        // Backspace/Delete
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (code >= 32 && code <= 126) {
        // Printable characters
        input += char;
        process.stdout.write("*");
      } else if (char.length > 1) {
        // Handle paste (multiple characters)
        // For pasted content, add all printable characters
        for (let i = 0; i < char.length; i++) {
          const charCode = char.charCodeAt(i);
          if (charCode >= 32 && charCode <= 126) {
            input += char[i];
            process.stdout.write("*");
          }
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Simple confirmation prompt
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} - True if user confirms (y/yes)
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Simple text input prompt with optional validation
 * @param {string} question - The question to ask
 * @param {function} validator - Optional validation function
 * @returns {Promise<string>} - The input string
 */
function askInput(question, validator) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      if (validator && !validator(answer)) {
        reject(new Error("Invalid input"));
      } else {
        resolve(answer);
      }
    });
  });
}

module.exports = {
  askSecureInput,
  askConfirmation,
  askInput,
};
